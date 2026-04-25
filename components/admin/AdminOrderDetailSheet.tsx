"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { buildTimeline, type AdminOrder } from "@/lib/admin/orders-admin";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function formatPayment(method: string) {
  const m = method.toLowerCase();
  if (m === "cod") return "COD";
  return method || "—";
}

type AdminOrderDetailSheetProps = {
  order: AdminOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional footer (e.g. status hint). If omitted, no footer strip is shown. */
  footer?: ReactNode;
};

export function AdminOrderDetailSheet({
  order: selected,
  open,
  onOpenChange,
  footer,
}: AdminOrderDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-lg"
      >
        {selected ? (
          <>
            <SheetHeader className="border-b border-border px-4 py-4 text-left">
              <SheetTitle className="flex flex-wrap items-center gap-2">
                <span>Order</span>
                <span className="font-mono text-orange-400">
                  {selected.orderNumber}
                </span>
              </SheetTitle>
              <p className="text-sm text-muted-foreground">
                {selected.createdAt
                  ? selected.createdAt.toLocaleString(undefined, {
                      dateStyle: "full",
                      timeStyle: "short",
                    })
                  : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                Payment: {formatPayment(selected.paymentMethod)} · Status:{" "}
                <span className="font-medium capitalize text-foreground">
                  {selected.status}
                </span>
              </p>
            </SheetHeader>

            <div className="flex-1 space-y-8 overflow-y-auto px-4 py-4">
              <section>
                <h3 className="text-sm font-semibold text-foreground">Items</h3>
                <ul className="mt-3 space-y-3">
                  {selected.items.map((line, idx) => (
                    <li
                      key={`${line.productId ?? idx}-${idx}`}
                      className="flex gap-3 rounded-lg border border-border bg-background/50 p-2"
                    >
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                        {line.image ? (
                          <Image
                            src={line.image}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="64px"
                            unoptimized={
                              line.image.startsWith("data:") ||
                              line.image.startsWith("blob:")
                            }
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                            —
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium leading-snug">{line.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[line.size, line.color].filter(Boolean).join(" · ") ||
                            "—"}
                        </p>
                        <p className="mt-1 text-sm">
                          Qty {line.quantity}
                          {line.price != null && !Number.isNaN(line.price) ? (
                            <span className="ml-2 text-muted-foreground">
                              × {inr.format(line.price)} ={" "}
                              {inr.format(line.price * line.quantity)}
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-foreground">
                  Customer & shipping
                </h3>
                <div className="mt-2 space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <p className="font-medium">
                    {selected.shippingAddress.fullName ?? "—"}
                  </p>
                  <p className="text-muted-foreground">
                    {selected.shippingAddress.email}
                  </p>
                  <p className="text-muted-foreground">
                    {selected.shippingAddress.phone}
                  </p>
                  <p className="pt-2 text-muted-foreground">
                    {selected.shippingAddress.line1}
                    {selected.shippingAddress.line2
                      ? `, ${selected.shippingAddress.line2}`
                      : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {[
                      selected.shippingAddress.city,
                      selected.shippingAddress.state,
                      selected.shippingAddress.pincode,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                  <p className="pt-2 text-xs text-muted-foreground">
                    User ID: {selected.userId}
                  </p>
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-foreground">Pricing</h3>
                <div className="mt-2 space-y-1 text-sm">
                  {selected.pricing.subtotal != null ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>{inr.format(selected.pricing.subtotal)}</span>
                    </div>
                  ) : null}
                  {selected.pricing.discount != null &&
                  selected.pricing.discount > 0 ? (
                    <div className="flex justify-between text-emerald-400">
                      <span>Discount</span>
                      <span>−{inr.format(selected.pricing.discount)}</span>
                    </div>
                  ) : null}
                  {selected.pricing.shipping != null ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>
                        {selected.pricing.shipping === 0
                          ? "Free"
                          : inr.format(selected.pricing.shipping)}
                      </span>
                    </div>
                  ) : null}
                  {selected.pricing.total != null ? (
                    <div className="flex justify-between border-t border-border pt-2 font-semibold">
                      <span>Total</span>
                      <span className="text-orange-400">
                        {inr.format(selected.pricing.total)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold text-foreground">
                  Status timeline
                </h3>
                <ol className="relative mt-3 space-y-4 border-l border-border pl-4">
                  {buildTimeline(selected).map((row, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-card" />
                      <p className="text-sm font-medium">{row.label}</p>
                      <p className="text-xs text-muted-foreground">{row.detail}</p>
                      <p className="text-xs tabular-nums text-muted-foreground/80">
                        {row.at.toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {footer ? (
              <div className="border-t border-border p-4">{footer}</div>
            ) : null}
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
