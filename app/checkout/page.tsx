"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ChevronLeft, Loader2, Tag } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  discountFromCoupon,
  normalizeCouponCode,
} from "@/lib/checkout/coupon";
import { validateCouponClient } from "@/lib/checkout/coupon-client";
import { deliverySchema, type DeliveryFormValues } from "@/lib/checkout/deliverySchema";
import { readSavedDelivery, writeSavedDelivery } from "@/lib/checkout/saved-delivery";
import { cartSubtotal, computePricing } from "@/lib/checkout/pricing";
import { COD_ADVANCE_INR } from "@/lib/checkout/constants";
import { revalidateCart } from "@/lib/checkout/revalidate-cart";
import {
  placeOrderViaServer,
  PlaceOrderError,
} from "@/lib/checkout/place-order-client";
import { createShiprocketOrder } from "@/lib/shiprocket/clientFetch";
import { checkPincodeServiceable } from "@/lib/shiprocket/clientServiceability";
import { writeOrderConfirmation } from "@/lib/checkout/order-confirmation-cache";
import {
  runCashfreeCheckout,
  CashfreeCheckoutError,
} from "@/lib/payments/cashfree-client";
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

/**
 * Minimal coupon snapshot we keep on the page after server validation. We
 * intentionally don't store the full doc so the UI can't second-guess the
 * server-side eligibility verdict; we just need enough to recompute the
 * discount when the cart subtotal changes.
 */
type AppliedCouponState = {
  code: string;
  type: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  minSubtotal: number;
  /** Discount last reported by the server for the subtotal at apply time. */
  discount: number;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCouponState | null>(
    null
  );
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [deliveryPrefsLoaded, setDeliveryPrefsLoaded] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "online">("online");


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
  // Keep the discount reactive to cart changes (e.g. user adjusts quantity
  // after applying). If the cart drops below the coupon's minimum, fall
  // back to zero — the order placement will then no longer try to charge a
  // discount and the server will reject any stale coupon code that comes
  // through.
  const discountAmount = useMemo(() => {
    if (!appliedCoupon) return 0;
    if (appliedCoupon.minSubtotal && subtotal < appliedCoupon.minSubtotal) {
      return 0;
    }
    return discountFromCoupon(appliedCoupon, subtotal);
  }, [appliedCoupon, subtotal]);

  const pricing = useMemo(
    () => computePricing(items, discountAmount),
    [items, discountAmount]
  );

  // If the cart drops below the minimum after applying, surface a hint so
  // the customer knows the discount has been temporarily disabled.
  const couponInactiveReason = useMemo(() => {
    if (!appliedCoupon) return null;
    if (
      appliedCoupon.minSubtotal &&
      subtotal < appliedCoupon.minSubtotal
    ) {
      return `Add ${inr.format(appliedCoupon.minSubtotal - subtotal)} more to use ${appliedCoupon.code}.`;
    }
    return null;
  }, [appliedCoupon, subtotal]);

  const applyCoupon = async () => {
    setCouponMessage(null);
    const raw = normalizeCouponCode(couponInput);
    if (!raw) {
      setCouponMessage("Enter a coupon code.");
      return;
    }
    setCouponLoading(true);
    try {
      const res = await validateCouponClient({ code: raw, subtotal });
      if (!res.ok) {
        setAppliedCoupon(null);
        setCouponMessage(res.message);
        return;
      }
      setAppliedCoupon({
        code: res.code,
        type: res.type,
        value: res.value,
        maxDiscount: res.maxDiscount,
        minSubtotal: 0, // server already cleared the subtotal check
        discount: res.discount,
      });
      setCouponMessage(`Applied ${res.code}.`);
      toast.success("Coupon applied", {
        description: `You saved ${inr.format(res.discount)}.`,
      });
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

      // 0) Re-check every line against current Firestore stock. Catches stale
      //    carts (item went OOS or quantity dropped since the user added it)
      //    BEFORE charging Cashfree — much nicer than a 400 from the server.
      try {
        const { changes, nextItems } = await revalidateCart(items);
        if (changes.length > 0) {
          useCartStore.setState({ items: nextItems });
          const removed = changes.filter((c) => c.type === "removed");
          const clamped = changes.filter((c) => c.type === "clamped");
          const parts: string[] = [];
          if (removed.length > 0) {
            parts.push(
              `${removed.length} item${removed.length === 1 ? "" : "s"} no longer available`
            );
          }
          if (clamped.length > 0) {
            parts.push(
              `${clamped.length} quantity${clamped.length === 1 ? "" : " items"} reduced`
            );
          }
          toast.warning("Cart updated", {
            description: `${parts.join(" · ")}. Please review and try again.`,
          });
          return;
        }
      } catch {
        // Don't block placement on revalidation network issues — server will catch it.
      }

      // 1) Run Cashfree first. For "online" we charge the full total; for
      //    "cod" we collect only a fixed advance (COD_ADVANCE_INR). The server
      //    re-prices the cart and decides the actual paise amount.
      let paymentRef:
        | { cfOrderId: string; cfPaymentId: string }
        | undefined;
      try {
        const result = await runCashfreeCheckout({
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            size: i.size || undefined,
            color: i.color || undefined,
          })),
          discount: pricing.discount,
          customer: {
            name: shippingAddress.fullName,
            email: shippingAddress.email,
            phone: shippingAddress.phone,
          },
          mode: paymentMethod === "cod" ? "advance" : "full",
        });
        paymentRef = {
          cfOrderId: result.cfOrderId,
          cfPaymentId: result.cfPaymentId,
        };
      } catch (e) {
        if (e instanceof CashfreeCheckoutError) {
          if (e.code === "dismissed") {
            toast.message("Payment cancelled");
            return;
          }
          toast.error("Payment failed", { description: e.message });
          return;
        }
        throw e;
      }

      // 2) Server-authoritative order placement. Server re-prices the cart from
      //    product docs and rejects any tampering. Verifies the Cashfree
      //    payment reference exists in cashfree_payments/{cfPaymentId}.
      const placed = await placeOrderViaServer({
        items,
        shippingAddress,
        paymentMethod,
        couponCode: appliedCoupon?.code ?? null,
        discount: pricing.discount,
        payment: paymentRef,
      });

      const pendingShipping: OrderShippingRecord = {
        provider: "shiprocket",
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      writeOrderConfirmation({
        orderId: placed.orderId,
        orderNumber: placed.orderNumber,
        paymentMethod: placed.paymentMethod,
        paymentStatus: placed.paymentStatus,
        pricing: {
          subtotal: placed.pricing.subtotal,
          discount: placed.pricing.discount,
          shipping: placed.pricing.shipping,
          total: placed.pricing.total,
          advancePaid: placed.pricing.advancePaid,
          balanceDue: placed.pricing.balanceDue,
          couponCode: placed.pricing.couponCode,
        },
        items: placed.items.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
        })),
        shipping: pendingShipping,
      });

      clearCart();
      router.push(
        `/order-confirmation?orderId=${encodeURIComponent(placed.orderId)}`
      );
      toast.success("Order placed");

      // 3) Fire-and-forget Shiprocket booking. Failures leave the order with
      //    shipping.status==="pending" for admin to rebook.
      void (async () => {
        const shipping = await createShiprocketOrder({
          orderNumber: placed.orderNumber,
          paymentMethod,
          items: placed.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
          shippingAddress,
          pricing: {
            subtotal: placed.pricing.subtotal,
            discount: placed.pricing.discount,
            shipping: placed.pricing.shipping,
            total: placed.pricing.total,
            advancePaid: placed.pricing.advancePaid,
          },
        });
        try {
          await updateDoc(doc(getDb(), "orders", placed.orderId), { shipping });
        } catch (err) {
          // Guests can't update — admin will see shipping.status==="pending".
          console.warn("[checkout] could not update order shipping", err);
        }
      })();
    } catch (e) {
      if (e instanceof PlaceOrderError) {
        toast.error(e.message, {
          description:
            e.code === "insufficient_stock"
              ? "Refresh and update quantities in your cart."
              : e.code === "server_not_configured"
                ? "The store is not fully configured yet — please contact support."
                : undefined,
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
      

    

      <div className="mt-2 flex gap-2">
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
            {couponInactiveReason ? (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                {couponInactiveReason}
              </p>
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
              onClick={() => setPaymentMethod("online")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
                paymentMethod === "online"
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-border hover:border-orange-500/40"
              )}
            >
              <span
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                  paymentMethod === "online"
                    ? "border-orange-500 bg-orange-500 shadow-inner"
                    : "border-muted-foreground"
                )}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="font-medium">Pay online (UPI / card / netbanking)</p>
                  <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                    Recommended
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pay {inr.format(pricing.total)} now via Cashfree. Fastest dispatch.
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod("cod")}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg border-2 p-4 text-left transition-colors",
                paymentMethod === "cod"
                  ? "border-orange-500 bg-orange-500/10"
                  : "border-border hover:border-orange-500/40"
              )}
            >
              <span
                className={cn(
                  "mt-1 h-4 w-4 shrink-0 rounded-full border-2",
                  paymentMethod === "cod"
                    ? "border-orange-500 bg-orange-500 shadow-inner"
                    : "border-muted-foreground"
                )}
              />
              <div className="min-w-0">
                <p className="font-medium">Cash on delivery</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pay {inr.format(COD_ADVANCE_INR)} online as advance.
                  Remaining {inr.format(Math.max(0, pricing.total - COD_ADVANCE_INR))} collected on delivery.
                </p>
              </div>
            </button>
          </div>

          {paymentMethod === "cod" && pricing.total > 0 ? (
            <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 text-sm">
              <p className="font-medium">Payment split</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Order total</span>
                  <span className="tabular-nums">{inr.format(pricing.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Advance (online, now)</span>
                  <span className="tabular-nums">
                    {inr.format(Math.min(COD_ADVANCE_INR, pricing.total))}
                  </span>
                </div>
                <div className="flex justify-between font-medium text-foreground">
                  <span>Due on delivery</span>
                  <span className="tabular-nums">
                    {inr.format(Math.max(0, pricing.total - COD_ADVANCE_INR))}
                  </span>
                </div>
              </div>
            </div>
          ) : null}

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
                  Processing payment…
                </>
              ) : paymentMethod === "online" ? (
                `Pay ${inr.format(pricing.total)}`
              ) : (
                `Pay ${inr.format(Math.min(COD_ADVANCE_INR, pricing.total))} advance & place order`
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
