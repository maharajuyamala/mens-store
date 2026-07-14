"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, FirestoreError } from "firebase/firestore";
import { Loader2, Printer } from "lucide-react";
import { getDb } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

type InvoiceData = {
  orderNumber: string;
  createdAt: Date | null;
  customer: {
    name?: string;
    email?: string;
    phone?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size?: string;
  }>;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    gst?: number;
    total: number;
    advancePaid?: number;
    balanceDue?: number;
  };
  paymentMethod: string;
  paymentStatus?: string;
};

function toDate(v: unknown): Date | null {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

export default function InvoicePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const { user, loading } = useAuth();

  const [data, setData] = useState<InvoiceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(
        `/auth/sign-in?next=${encodeURIComponent(`/account/orders/${orderId}/invoice`)}`
      );
      return;
    }
    if (!orderId) return;

    let cancelled = false;
    (async () => {
      try {
        const snap = await getDoc(doc(getDb(), "orders", orderId));
        if (cancelled) return;
        if (!snap.exists()) {
          setError("Order not found.");
          setFetching(false);
          return;
        }
        const d = snap.data();
        const addr = (d.shippingAddress ?? {}) as Record<string, unknown>;
        const p = (d.pricing ?? {}) as Record<string, unknown>;
        const items = Array.isArray(d.items) ? d.items : [];
        setData({
          orderNumber:
            typeof d.orderNumber === "string" ? d.orderNumber : orderId.slice(0, 8),
          createdAt: toDate(d.createdAt),
          customer: {
            name: typeof addr.fullName === "string" ? addr.fullName : undefined,
            email: typeof addr.email === "string" ? addr.email : undefined,
            phone: typeof addr.phone === "string" ? addr.phone : undefined,
            line1: typeof addr.line1 === "string" ? addr.line1 : undefined,
            line2: typeof addr.line2 === "string" ? addr.line2 : undefined,
            city: typeof addr.city === "string" ? addr.city : undefined,
            state: typeof addr.state === "string" ? addr.state : undefined,
            pincode: typeof addr.pincode === "string" ? addr.pincode : undefined,
          },
          items: items.map((row) => {
            const r = row as Record<string, unknown>;
            return {
              name: typeof r.name === "string" ? r.name : "Item",
              quantity:
                typeof r.quantity === "number"
                  ? r.quantity
                  : Number(r.quantity) || 0,
              price:
                typeof r.price === "number" ? r.price : Number(r.price) || 0,
              size: typeof r.size === "string" ? r.size : undefined,
            };
          }),
          pricing: {
            subtotal: Number(p.subtotal) || 0,
            discount: Number(p.discount) || 0,
            shipping: Number(p.shipping) || 0,
            gst:
              p.gst && typeof p.gst === "object" &&
              "totalGst" in (p.gst as Record<string, unknown>) &&
              Number.isFinite(
                Number((p.gst as Record<string, unknown>).totalGst)
              )
                ? Number((p.gst as Record<string, unknown>).totalGst)
                : undefined,
            total: Number(p.total) || 0,
            advancePaid:
              p.advancePaid != null && !Number.isNaN(Number(p.advancePaid))
                ? Number(p.advancePaid)
                : undefined,
            balanceDue:
              p.balanceDue != null && !Number.isNaN(Number(p.balanceDue))
                ? Number(p.balanceDue)
                : undefined,
          },
          paymentMethod:
            typeof d.paymentMethod === "string" ? d.paymentMethod : "cod",
          paymentStatus:
            typeof d.paymentStatus === "string" ? d.paymentStatus : undefined,
        });
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof FirestoreError && e.code === "permission-denied"
              ? "You can only view invoices for your own orders."
              : "Could not load this invoice."
          );
        }
      } finally {
        if (!cancelled) setFetching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, user, orderId, router]);

  if (loading || fetching) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-sm text-muted-foreground">Loading invoice…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-28 text-center">
        <h1 className="text-xl font-semibold">Invoice unavailable</h1>
        <p className="mt-2 text-muted-foreground">
          {error ?? "We couldn't load this invoice."}
        </p>
        <Button asChild className="mt-8 bg-orange-600 text-white hover:bg-orange-500">
          <Link href="/account">Back to account</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 print:p-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="outline" asChild>
          <Link href="/account">← Back to account</Link>
        </Button>
        <Button
          className="bg-orange-600 text-white hover:bg-orange-500"
          onClick={() => window.print()}
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / Save as PDF
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border pb-6">
          <div>
            <p className="text-2xl font-bold tracking-tight">SecondSkin</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tax invoice / Bill of supply
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">Invoice #{data.orderNumber}</p>
            {data.createdAt ? (
              <p className="text-muted-foreground">
                {data.createdAt.toLocaleString("en-IN")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Billed to
            </p>
            <div className="mt-1 space-y-0.5 text-sm">
              {data.customer.name ? <p className="font-semibold">{data.customer.name}</p> : null}
              {data.customer.line1 ? <p>{data.customer.line1}</p> : null}
              {data.customer.line2 ? <p>{data.customer.line2}</p> : null}
              {data.customer.city || data.customer.state || data.customer.pincode ? (
                <p>
                  {[data.customer.city, data.customer.state]
                    .filter(Boolean)
                    .join(", ")}
                  {data.customer.pincode ? ` ${data.customer.pincode}` : ""}
                </p>
              ) : null}
              {data.customer.email ? <p>{data.customer.email}</p> : null}
              {data.customer.phone ? <p>{data.customer.phone}</p> : null}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Payment
            </p>
            <p className="mt-1 text-sm">
              {data.paymentMethod === "cod"
                ? "Cash on delivery"
                : "Paid online (Cashfree)"}
            </p>
            {data.paymentStatus ? (
              <p className="text-sm text-muted-foreground">
                Status: {data.paymentStatus}
              </p>
            ) : null}
          </div>
        </div>

        <table className="mt-8 w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qty</th>
              <th className="py-2 text-right font-medium">Unit</th>
              <th className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((it, i) => (
              <tr key={i} className="border-b border-border/60">
                <td className="py-3">
                  {it.name}
                  {it.size ? (
                    <span className="ml-1 text-muted-foreground">· {it.size}</span>
                  ) : null}
                </td>
                <td className="py-3 text-right tabular-nums">{it.quantity}</td>
                <td className="py-3 text-right tabular-nums">
                  {inr.format(it.price)}
                </td>
                <td className="py-3 text-right tabular-nums">
                  {inr.format(it.price * it.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <table className="w-72 text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-muted-foreground">Subtotal</td>
                <td className="py-1 text-right tabular-nums">
                  {inr.format(data.pricing.subtotal)}
                </td>
              </tr>
              {data.pricing.discount > 0 ? (
                <tr>
                  <td className="py-1 text-muted-foreground">Discount</td>
                  <td className="py-1 text-right tabular-nums text-emerald-600">
                    −{inr.format(data.pricing.discount)}
                  </td>
                </tr>
              ) : null}
              <tr>
                <td className="py-1 text-muted-foreground">Delivery</td>
                <td className="py-1 text-right tabular-nums">
                  {data.pricing.shipping === 0
                    ? "Free"
                    : inr.format(data.pricing.shipping)}
                </td>
              </tr>
              {typeof data.pricing.gst === "number" && data.pricing.gst > 0 ? (
                <tr>
                  <td className="py-1 text-xs text-muted-foreground">
                    Includes GST
                  </td>
                  <td className="py-1 text-right text-xs tabular-nums text-muted-foreground">
                    {inr.format(data.pricing.gst)}
                  </td>
                </tr>
              ) : null}
              <tr className="border-t border-border">
                <td className="py-2 font-semibold">Total</td>
                <td className="py-2 text-right text-lg font-semibold tabular-nums text-orange-600">
                  {inr.format(data.pricing.total)}
                </td>
              </tr>
              {data.paymentMethod === "cod" &&
              data.pricing.balanceDue != null &&
              data.pricing.balanceDue > 0 ? (
                <>
                  <tr>
                    <td className="py-1 text-muted-foreground">
                      Advance paid (online)
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {inr.format(data.pricing.advancePaid ?? 0)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold">Balance due on delivery</td>
                    <td className="py-1 text-right font-semibold tabular-nums text-orange-600">
                      {inr.format(data.pricing.balanceDue)}
                    </td>
                  </tr>
                </>
              ) : null}
            </tbody>
          </table>
        </div>

        <p className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
          Thank you for shopping with SecondSkin.
        </p>
      </div>
    </div>
  );
}
