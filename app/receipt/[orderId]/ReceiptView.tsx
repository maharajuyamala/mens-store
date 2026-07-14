"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

export type ReceiptData = {
  orderId: string;
  orderNumber: string;
  createdAtIso: string | null;
  paymentMethod: string;
  paymentStatus: string | null;
  saleChannel: string | null;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    size: string | null;
    color: string | null;
  }>;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    gst: number | null;
    total: number;
    advancePaid: number | null;
    balanceDue: number | null;
  };
  expiresAtIso: string;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function paymentLabel(method: string, channel: string | null): string {
  if (channel === "pos") return "Paid at store";
  if (method === "cod") return "Cash on delivery";
  if (method === "online") return "Paid online (Cashfree)";
  return method;
}

export function ReceiptView({ data }: { data: ReceiptData }) {
  const { customer, items, pricing } = data;
  const addrCityStatePin = [
    [customer.city, customer.state].filter(Boolean).join(", "),
    customer.pincode ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <style>{`
        @page { margin: 0.4in; size: auto; }
        @media print {
          .no-print { display: none !important; }
          #receipt-paper {
            border: 0 !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Receipt
            </p>
            <p className="text-sm text-muted-foreground">
              Link valid until {fmtDate(data.expiresAtIso)}
            </p>
          </div>
          <Button
            className="bg-orange-600 text-white hover:bg-orange-500"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Download / Print
          </Button>
        </div>

        <div
          id="receipt-paper"
          className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-10"
        >
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
            <div>
              <p className="text-2xl font-bold tracking-tight">SecondSkin</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {data.saleChannel === "pos"
                  ? "Store receipt"
                  : "Tax invoice / Bill of supply"}
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold">#{data.orderNumber}</p>
              <p className="text-muted-foreground">{fmtDate(data.createdAtIso)}</p>
            </div>
          </header>

          <section className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Customer
              </p>
              <div className="mt-1 space-y-0.5 text-sm">
                {customer.name ? (
                  <p className="font-semibold">{customer.name}</p>
                ) : null}
                {customer.line1 ? <p>{customer.line1}</p> : null}
                {customer.line2 ? <p>{customer.line2}</p> : null}
                {addrCityStatePin ? <p>{addrCityStatePin}</p> : null}
                {customer.email ? <p>{customer.email}</p> : null}
                {customer.phone ? <p>{customer.phone}</p> : null}
              </div>
            </div>
            <div className="sm:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Payment
              </p>
              <p className="mt-1 text-sm">
                {paymentLabel(data.paymentMethod, data.saleChannel)}
              </p>
              {data.paymentStatus ? (
                <p className="text-sm text-muted-foreground">
                  Status: {data.paymentStatus}
                </p>
              ) : null}
            </div>
          </section>

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
              {items.map((it, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="py-3">
                    <div className="font-medium">{it.name}</div>
                    {it.color || it.size ? (
                      <div className="text-xs text-muted-foreground">
                        {[it.color, it.size].filter(Boolean).join(" · ")}
                      </div>
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
                    {inr.format(pricing.subtotal)}
                  </td>
                </tr>
                {pricing.discount > 0 ? (
                  <tr>
                    <td className="py-1 text-muted-foreground">Discount</td>
                    <td className="py-1 text-right tabular-nums text-emerald-600">
                      −{inr.format(pricing.discount)}
                    </td>
                  </tr>
                ) : null}
                <tr>
                  <td className="py-1 text-muted-foreground">Delivery</td>
                  <td className="py-1 text-right tabular-nums">
                    {pricing.shipping === 0 ? "Free" : inr.format(pricing.shipping)}
                  </td>
                </tr>
                {pricing.gst != null && pricing.gst > 0 ? (
                  <tr>
                    <td className="py-1 text-xs text-muted-foreground">
                      Includes GST
                    </td>
                    <td className="py-1 text-right text-xs tabular-nums text-muted-foreground">
                      {inr.format(pricing.gst)}
                    </td>
                  </tr>
                ) : null}
                <tr className="border-t border-border">
                  <td className="py-2 font-semibold">Total</td>
                  <td className="py-2 text-right text-lg font-semibold tabular-nums text-orange-600">
                    {inr.format(pricing.total)}
                  </td>
                </tr>
                {data.paymentMethod === "cod" &&
                pricing.balanceDue != null &&
                pricing.balanceDue > 0 ? (
                  <>
                    <tr>
                      <td className="py-1 text-muted-foreground">
                        Advance paid (online)
                      </td>
                      <td className="py-1 text-right tabular-nums">
                        {inr.format(pricing.advancePaid ?? 0)}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1 font-semibold">Balance due on delivery</td>
                      <td className="py-1 text-right font-semibold tabular-nums text-orange-600">
                        {inr.format(pricing.balanceDue)}
                      </td>
                    </tr>
                  </>
                ) : null}
              </tbody>
            </table>
          </div>

          <footer className="mt-8 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            Thank you for shopping with SecondSkin.
          </footer>
        </div>
      </div>
    </div>
  );
}
