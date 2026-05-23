"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronLeft, Loader2, Tag } from "lucide-react";
import { FirebaseError } from "firebase/app";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  discountFromCoupon,
  fetchCouponByCode,
  type CouponDoc,
} from "@/lib/checkout/coupon";
import { deliverySchema, type DeliveryFormValues } from "@/lib/checkout/deliverySchema";
import { readSavedDelivery, writeSavedDelivery } from "@/lib/checkout/saved-delivery";
import { cartSubtotal, computePricing } from "@/lib/checkout/pricing";
import { generateOrderNumber, placeOrder } from "@/lib/checkout/placeOrder";
import { CheckoutStockError } from "@/lib/checkout/stock";
import { createShiprocketOrder } from "@/lib/shiprocket/clientFetch";
import { checkPincodeServiceable } from "@/lib/shiprocket/clientServiceability";
import { writeOrderConfirmation } from "@/lib/checkout/order-confirmation-cache";
import type { OrderShippingRecord } from "@/lib/shiprocket/types";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const STEPS = [
  { n: 1, label: "Contact & delivery" },
  { n: 2, label: "Order review" },
  { n: 3, label: "Payment" },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponDoc | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [deliveryPrefsLoaded, setDeliveryPrefsLoaded] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);

  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliverySchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
    },
  });

  const { register, handleSubmit, formState, setValue, getValues, reset } = form;
  const { errors, isSubmitting } = formState;

  useEffect(() => {
    const saved = readSavedDelivery();
    if (saved) {
      reset(saved);
    }
    setDeliveryPrefsLoaded(true);
  }, [reset]);

  useEffect(() => {
    if (!deliveryPrefsLoaded) return;
    const email = getValues("email")?.trim();
    if (user?.email && !email) {
      setValue("email", user.email);
    }
  }, [deliveryPrefsLoaded, user?.email, getValues, setValue]);

  const subtotal = useMemo(() => cartSubtotal(items), [items]);
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    return discountFromCoupon(appliedCoupon, subtotal);
  }, [appliedCoupon, subtotal]);

  const pricing = useMemo(
    () => computePricing(items, discountAmount),
    [items, discountAmount]
  );

  const applyCoupon = async () => {
    setCouponMessage(null);
    const raw = couponInput.trim();
    if (!raw) {
      setCouponMessage("Enter a coupon code.");
      return;
    }
    setCouponLoading(true);
    try {
      const c = await fetchCouponByCode(raw);
      if (!c) {
        setAppliedCoupon(null);
        setCouponMessage("Invalid or expired coupon.");
        return;
      }
      setAppliedCoupon(c);
      setCouponMessage(`Applied ${c.code}.`);
      toast.success("Coupon applied");
    } catch {
      setCouponMessage("Could not verify coupon. Try again.");
    } finally {
      setCouponLoading(false);
    }
  };

  const clearCoupon = () => {
    setAppliedCoupon(null);
    setCouponMessage(null);
    setCouponInput("");
  };

  const onPlaceOrder = async () => {
    if (items.length === 0) {
      toast.error("Your cart is empty.");
      return;
    }
    setPlacing(true);
    try {
      const shippingAddress = getValues();
      writeSavedDelivery(shippingAddress);

      const orderNumber = generateOrderNumber();
      const pendingShipping: OrderShippingRecord = {
        provider: "shiprocket",
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      // 1) Persist order first. If this fails, no shipment is booked.
      const result = await placeOrder({
        items,
        shippingAddress,
        pricing,
        couponCode: appliedCoupon?.code ?? null,
        paymentMethod: "cod",
        userId: user?.uid ?? "guest",
        orderNumber,
        shipping: pendingShipping,
      });

      // Stash a local copy so the confirmation page can render even for guests
      // (Firestore order-read is restricted to owner/admin).
      writeOrderConfirmation({
        orderId: result.orderId,
        orderNumber: result.orderNumber,
        pricing: {
          subtotal: pricing.subtotal,
          discount: pricing.discount,
          shipping: pricing.shipping,
          total: pricing.total,
          couponCode: appliedCoupon?.code ?? null,
        },
        items: items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        shipping: pendingShipping,
      });

      clearCart();

      // Navigate immediately — the Shiprocket booking continues in the background.
      router.push(
        `/order-confirmation?orderId=${encodeURIComponent(result.orderId)}`
      );
      toast.success("Order placed");

      // 2) Fire-and-forget Shiprocket booking + best-effort order update.
      void (async () => {
        const shipping = await createShiprocketOrder({
          orderNumber,
          paymentMethod: "cod",
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
          shippingAddress,
          pricing: {
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            shipping: pricing.shipping,
            total: pricing.total,
          },
        });
        try {
          await updateDoc(doc(getDb(), "orders", result.orderId), {
            shipping,
          });
        } catch (err) {
          // Owner update permission may be missing (guests, or rules not deployed).
          // Order is preserved; admin will see shipping.status==="pending" and rebook.
          console.warn("[checkout] could not update order shipping", err);
        }
      })();
    } catch (e) {
      if (e instanceof CheckoutStockError) {
        toast.error(e.message, {
          description:
            e.code === "INSUFFICIENT_STOCK"
              ? "Refresh and update quantities in your cart."
              : undefined,
        });
        return;
      }
      if (e instanceof FirebaseError && e.code === "permission-denied") {
        toast.error("Permission denied.", {
          description:
            e.message ||
            "Deploy latest firestore.rules (npm run deploy:rules) or sign in again.",
        });
        return;
      }
      console.error(e);
      toast.error("Could not place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
        <p className="mt-2 text-muted-foreground">
          Your cart is empty. Add items before checking out.
        </p>
        <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
          <Link href="/explore">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 pb-16">
      <Link
        href="/explore"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to shop
      </Link>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        Checkout
      </h1>

      <div className="mt-8 flex gap-2">
        {STEPS.map((s, i) => (
          <div key={s.n} className="flex flex-1 flex-col gap-2">
            <div
              className={cn(
                "h-1.5 rounded-full transition-colors",
                step >= s.n ? "bg-orange-500" : "bg-muted"
              )}
            />
            <span
              className={cn(
                "text-xs font-medium",
                step >= s.n ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {i + 1}. {s.label}
            </span>
          </div>
        ))}
      </div>

      {step === 1 ? (
        <form
          className="mt-10 space-y-6"
          onSubmit={handleSubmit(async (data) => {
            setPincodeError(null);
            setCheckingPincode(true);
            try {
              const sr = await checkPincodeServiceable(data.pincode, {
                cod: true,
              });
              if (!sr.serviceable && !sr.failOpen) {
                setPincodeError(
                  "Sorry — we can't deliver to this PIN code yet. Try a different address."
                );
                return;
              }
              writeSavedDelivery(data);
              setStep(2);
            } finally {
              setCheckingPincode(false);
            }
          })}
        >
          <h2 className="text-lg font-semibold">Contact & delivery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                aria-invalid={!!errors.fullName}
                {...register("fullName")}
              />
              {errors.fullName ? (
                <p className="text-sm text-destructive">{errors.fullName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register("email")}
              />
              {errors.email ? (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={!!errors.phone}
                {...register("phone")}
              />
              {errors.phone ? (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="line1">Address line 1</Label>
              <Input
                id="line1"
                aria-invalid={!!errors.line1}
                {...register("line1")}
              />
              {errors.line1 ? (
                <p className="text-sm text-destructive">{errors.line1.message}</p>
              ) : null}
            </div>
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="line2">Address line 2 (optional)</Label>
              <Input id="line2" {...register("line2")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" aria-invalid={!!errors.city} {...register("city")} />
              {errors.city ? (
                <p className="text-sm text-destructive">{errors.city.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">State</Label>
              <Input id="state" aria-invalid={!!errors.state} {...register("state")} />
              {errors.state ? (
                <p className="text-sm text-destructive">{errors.state.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pincode">PIN code</Label>
              <Input
                id="pincode"
                inputMode="numeric"
                maxLength={6}
                aria-invalid={!!errors.pincode}
                {...register("pincode")}
              />
              {errors.pincode ? (
                <p className="text-sm text-destructive">
                  {errors.pincode.message}
                </p>
              ) : null}
            </div>
          </div>
          {pincodeError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {pincodeError}
            </p>
          ) : null}
          <Button
            type="submit"
            className="bg-orange-600 text-white hover:bg-orange-500"
            disabled={isSubmitting || checkingPincode}
          >
            {checkingPincode ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Checking PIN code…
              </>
            ) : (
              "Continue to review"
            )}
          </Button>
        </form>
      ) : null}

      {step === 2 ? (
        <div className="mt-10 space-y-8">
          <h2 className="text-lg font-semibold">Order review</h2>

          <ul className="space-y-3 rounded-lg border border-border bg-card p-4">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex gap-3 border-b border-border pb-3 last:border-0 last:pb-0"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized={
                        item.image.startsWith("data:") ||
                        item.image.startsWith("blob:")
                      }
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium leading-snug">{item.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[item.size, item.color].filter(Boolean).join(" · ") || "—"} ·
                    Qty {item.quantity}
                  </p>
                  <p className="text-sm font-semibold text-orange-600">
                    {inr.format(item.price * item.quantity)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-1 min-w-[200px] items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  disabled={!!appliedCoupon}
                />
              </div>
              {appliedCoupon ? (
                <Button type="button" variant="outline" onClick={clearCoupon}>
                  Remove
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void applyCoupon()}
                  disabled={couponLoading}
                >
                  {couponLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              )}
            </div>
            {couponMessage ? (
              <p className="mt-2 text-sm text-muted-foreground">{couponMessage}</p>
            ) : null}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{inr.format(pricing.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums text-emerald-600">
                −{inr.format(pricing.discount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums">
                {pricing.shipping === 0
                  ? "Free"
                  : inr.format(pricing.shipping)}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums text-orange-600">
                {inr.format(pricing.total)}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-500"
              onClick={() => setStep(3)}
            >
              Continue to payment
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-10 space-y-8">
          <h2 className="text-lg font-semibold">Payment</h2>
          <div className="space-y-3">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg border-2 border-orange-500 bg-orange-500/10 p-4 text-left"
            >
              <span className="h-4 w-4 rounded-full border-2 border-orange-500 bg-orange-500 shadow-inner" />
              <div>
                <p className="font-medium">Cash on delivery</p>
                <p className="text-sm text-muted-foreground">
                  Pay when your order arrives.
                </p>
              </div>
            </button>
            <button
              type="button"
              disabled
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg border border-border bg-muted/40 p-4 text-left opacity-60"
            >
              <span className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
              <div>
                <p className="font-medium">Pay online</p>
                <p className="text-sm text-muted-foreground">Coming soon</p>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-orange-600 text-white hover:bg-orange-500"
              disabled={placing}
              onClick={() => void onPlaceOrder()}
            >
              {placing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Placing order…
                </>
              ) : (
                "Place order"
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
