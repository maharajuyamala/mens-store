"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useCartDrawerStore } from "@/store/cartDrawerStore";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

const FREE_SHIPPING_THRESHOLD = 999;
const STANDARD_SHIPPING = 99;

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function CartDrawer() {
  const open = useCartDrawerStore((s) => s.open);
  const onOpenChange = useCartDrawerStore((s) => s.setOpen);
  const items = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const getTotal = useCartStore((s) => s.getTotal);

  const subtotal = getTotal();
  const shipping =
    items.length === 0
      ? 0
      : subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : STANDARD_SHIPPING;
  const total = subtotal + shipping;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-border p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border px-4 py-4 text-left">
          <SheetTitle className="text-lg font-semibold">Your cart</SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
            <div className="rounded-full bg-muted p-4">
              <ShoppingBag className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium text-foreground">Your cart is empty</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add something you love — we&apos;ll hold it here.
              </p>
            </div>
            <Button asChild className="bg-orange-600 text-white hover:bg-orange-500">
              <Link href="/explore" onClick={() => onOpenChange(false)}>
                Continue shopping
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <ul className="flex flex-col gap-4">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className="flex gap-3 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                      {item.image ? (
                        <Image
                          src={item.image}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="80px"
                          unoptimized={
                            item.image.startsWith("data:") ||
                            item.image.startsWith("blob:")
                          }
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                          No img
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium leading-snug">
                        {item.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[item.size, item.color].filter(Boolean).join(" · ") ||
                          "—"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-orange-600">
                        {inr.format(item.price * item.quantity)}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex items-center rounded-full border border-border">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            disabled={item.quantity <= 1}
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                          <span className="min-w-[1.5rem] text-center text-sm tabular-nums">
                            {item.quantity}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(item.id)}
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border bg-muted/30 px-4 py-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium tabular-nums">
                    {inr.format(subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Estimated shipping
                  </span>
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      shipping === 0 &&
                        subtotal >= FREE_SHIPPING_THRESHOLD &&
                        "text-emerald-600 dark:text-emerald-400"
                    )}
                  >
                    {subtotal >= FREE_SHIPPING_THRESHOLD
                      ? "Free"
                      : inr.format(STANDARD_SHIPPING)}
                  </span>
                </div>
                {subtotal > 0 && subtotal < FREE_SHIPPING_THRESHOLD ? (
                  <p className="text-xs text-muted-foreground">
                    Add {inr.format(FREE_SHIPPING_THRESHOLD - subtotal)} more
                    for free shipping (over {inr.format(FREE_SHIPPING_THRESHOLD)}
                    ).
                  </p>
                ) : null}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums text-orange-600">
                    {inr.format(total)}
                  </span>
                </div>
              </div>
              <Button
                asChild
                className="mt-4 w-full bg-orange-600 text-white hover:bg-orange-500"
                size="lg"
              >
                <Link href="/checkout" onClick={() => onOpenChange(false)}>
                  Proceed to checkout
                </Link>
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
