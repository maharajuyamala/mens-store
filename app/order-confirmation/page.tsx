"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc, FirestoreError } from "firebase/firestore";
import { Loader2, PackageCheck } from "lucide-react";
import { getDb } from "@/app/firebase";
import { Button } from "@/components/ui/button";
import { readOrderConfirmation } from "@/lib/checkout/order-confirmation-cache";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

type OrderPricing = {
  subtotal?: number;
  discount?: number;
  shipping?: number;
  total?: number;
  couponCode?: string | null;
};

type ShippingSummary = {
  status?: string;
  awbCode?: string | null;
  courierName?: string | null;
};

type LoadedOrder = {
  orderNumber: string;
  pricing: OrderPricing;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  shipping?: ShippingSummary;
};

function shiprocketTrackingUrl(awbCode: string): string {
  return `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`;
}

function OrderConfirmationInner() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<LoadedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError("missing_id");
      return;
    }

    // Prefer the cached copy written by the checkout flow. Works for guests too,
    // since Firestore orders are no longer publicly readable.
    const cached = readOrderConfirmation(orderId);
    if (cached) {
      setOrder({
        orderNumber: cached.orderNumber,
        pricing: cached.pricing,
        items: cached.items,
        shipping: cached.shipping
          ? {
              status: cached.shipping.status,
              awbCode: cached.shipping.awbCode ?? null,
              courierName: cached.shipping.courierName ?? null,
            }
          : undefined,
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "orders", orderId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError("not_found");
          setLoading(false);
          return;
        }
        const d = snap.data();
        const orderNumber =
          typeof d.orderNumber === "string" ? d.orderNumber : "—";
        const pricing = (d.pricing ?? {}) as OrderPricing;
        const rawItems = Array.isArray(d.items) ? d.items : [];
        const items = rawItems.map((row: Record<string, unknown>) => ({
          name: typeof row.name === "string" ? row.name : "Item",
          quantity:
            typeof row.quantity === "number" ? row.quantity : Number(row.quantity) || 0,
          price: typeof row.price === "number" ? row.price : Number(row.price),
        }));
        const shippingRaw = d.shipping;
        const shipping: ShippingSummary | undefined =
          shippingRaw && typeof shippingRaw === "object"
            ? {
                status:
                  typeof (shippingRaw as Record<string, unknown>).status === "string"
                    ? ((shippingRaw as Record<string, unknown>).status as string)
                    : undefined,
                awbCode:
                  typeof (shippingRaw as Record<string, unknown>).awbCode === "string"
                    ? ((shippingRaw as Record<string, unknown>).awbCode as string)
                    : null,
                courierName:
                  typeof (shippingRaw as Record<string, unknown>).courierName === "string"
                    ? ((shippingRaw as Record<string, unknown>).courierName as string)
                    : null,
              }
            : undefined;
        setOrder({ orderNumber, pricing, items, shipping });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof FirestoreError && e.code === "permission-denied"
              ? "permission"
              : "fetch"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (!orderId || error === "missing_id") {
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <h1 className="text-xl font-semibold">No order specified</h1>
        <p className="mt-2 text-muted-foreground">
          Open this page from checkout after placing an order.
        </p>
        <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
          <Link href="/explore">Continue shopping</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 py-28">
        <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
        <p className="text-muted-foreground">Loading order…</p>
      </div>
    );
  }

  if (error || !order) {
    const isPermission = error === "permission";
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <h1 className="text-xl font-semibold">
          {isPermission ? "Sign in to view this order" : "Order not found"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {isPermission
            ? "This order can only be viewed by the account that placed it."
            : "We couldn't load this order. The link may be invalid."}
        </p>
        <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
          <Link href={isPermission ? "/auth/sign-in" : "/explore"}>
            {isPermission ? "Sign in" : "Continue shopping"}
          </Link>
        </Button>
      </div>
    );
  }

  const p = order.pricing;

  return (
    <div className="mx-auto max-w-lg px-4 py-24 pb-16">
      <div className="flex flex-col items-center text-center">
        <div className="rounded-full bg-emerald-500/15 p-4">
          <PackageCheck className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">
          Thank you for your order
        </h1>
        <p className="mt-2 text-muted-foreground">
          Your order number is{" "}
          <span className="font-mono font-semibold text-foreground">
            {order.orderNumber}
          </span>
        </p>
      </div>

      <div className="mt-10 rounded-lg border border-border bg-card p-4 text-left">
        <h2 className="font-semibold">Summary</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-4">
              <span className="text-muted-foreground">
                {it.name} × {it.quantity}
              </span>
              {typeof it.price === "number" && !Number.isNaN(it.price) ? (
                <span className="tabular-nums">
                  {inr.format(it.price * it.quantity)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm">
          {typeof p.subtotal === "number" ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="tabular-nums">{inr.format(p.subtotal)}</span>
            </div>
          ) : null}
          {typeof p.discount === "number" && p.discount > 0 ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span className="tabular-nums text-emerald-600">
                −{inr.format(p.discount)}
              </span>
            </div>
          ) : null}
          {typeof p.shipping === "number" ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="tabular-nums">
                {p.shipping === 0 ? "Free" : inr.format(p.shipping)}
              </span>
            </div>
          ) : null}
          {typeof p.total === "number" ? (
            <div className="mt-2 flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="tabular-nums text-orange-600">
                {inr.format(p.total)}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {order.shipping?.awbCode ? (
        <div className="mt-6 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <p className="font-medium">Your shipment is booked</p>
          <p className="mt-1 text-muted-foreground">
            {order.shipping.courierName
              ? `${order.shipping.courierName} · `
              : ""}
            AWB{" "}
            <span className="font-mono">{order.shipping.awbCode}</span>
          </p>
          <a
            className="mt-2 inline-flex text-orange-600 hover:text-orange-500"
            href={shiprocketTrackingUrl(order.shipping.awbCode)}
            target="_blank"
            rel="noreferrer"
          >
            Track your package →
          </a>
        </div>
      ) : order.shipping?.status === "pending" ? (
        <p className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          We&apos;re booking your shipment. You&apos;ll receive tracking details
          shortly.
        </p>
      ) : null}

      <Button asChild className="mt-8 w-full bg-orange-600 text-white hover:bg-orange-500">
        <Link href="/explore">Continue shopping</Link>
      </Button>
    </div>
  );
}

function OrderConfirmationFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center py-28">
      <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<OrderConfirmationFallback />}>
      <OrderConfirmationInner />
    </Suspense>
  );
}
