import { describe, it, expect } from "vitest";
import { cartSubtotal, computePricing } from "@/lib/checkout/pricing";
import { FREE_SHIPPING_THRESHOLD_INR } from "@/lib/checkout/constants";
import type { CartItem } from "@/store/cartStore";

function item(partial: Partial<CartItem> & { price: number; quantity: number }): CartItem {
  return {
    id: partial.id ?? "l1",
    productId: partial.productId ?? "p1",
    name: partial.name ?? "Item",
    image: partial.image ?? "",
    price: partial.price,
    size: partial.size ?? "M",
    color: partial.color ?? "navy",
    quantity: partial.quantity,
  };
}

describe("cartSubtotal", () => {
  it("sums price * quantity", () => {
    expect(cartSubtotal([item({ price: 100, quantity: 2 }), item({ price: 50, quantity: 1 })])).toBe(250);
  });
});

describe("computePricing", () => {
  it("clamps discount to the subtotal (never negative total)", () => {
    const p = computePricing([item({ price: 100, quantity: 1 })], 500, 0);
    expect(p.discount).toBe(100);
    expect(p.total).toBe(0);
  });

  it("total = discounted subtotal + shipping", () => {
    const p = computePricing([item({ price: 100, quantity: 3 })], 50, 40);
    expect(p.subtotal).toBe(300);
    expect(p.discountedSubtotal).toBe(250);
    // 250 is below the free-shipping threshold in a typical config, so the
    // provided 40 shipping stands unless the threshold is very low.
    const expectedShipping = 250 >= FREE_SHIPPING_THRESHOLD_INR ? 0 : 40;
    expect(p.shipping).toBe(expectedShipping);
    expect(p.total).toBe(250 + expectedShipping);
  });

  it("applies free shipping at/above the threshold", () => {
    const above = FREE_SHIPPING_THRESHOLD_INR + 1;
    const p = computePricing([item({ price: above, quantity: 1 })], 0, 99);
    if (FREE_SHIPPING_THRESHOLD_INR > 0) {
      expect(p.freeShippingApplied).toBe(true);
      expect(p.shipping).toBe(0);
    }
  });
});
