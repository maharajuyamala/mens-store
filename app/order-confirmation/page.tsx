"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Loader2, PackageCheck } from "lucide-react";
import { getDb } from "@/app/firebase";
import { Button } from "@/components/ui/button";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

type OrderPricing = {
  subtotal?: number;
  discount?: number;
  shipping?: number;
  gst?: number;
  total?: number;
  couponCode?: string | null;
};

type LoadedOrder = {
  orderNumber: string;
  pricing: OrderPricing;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
};

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
        setOrder({ orderNumber, pricing, items });
      } catch {
        if (!cancelled) setError("fetch");
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
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <h1 className="text-xl font-semibold">Order not found</h1>
        <p className="mt-2 text-muted-foreground">
          We couldn&apos;t load this order. The link may be invalid.
        </p>
        <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
          <Link href="/explore">Continue shopping</Link>
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
          {typeof p.gst === "number" ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">GST (18%)</span>
              <span className="tabular-nums">{inr.format(p.gst)}</span>
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
