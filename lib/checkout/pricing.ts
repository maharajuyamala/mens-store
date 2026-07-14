import {
  FREE_SHIPPING_THRESHOLD_INR,
  STANDARD_SHIPPING_INR,
} from "@/lib/checkout/constants";
import { computeGstBreakdown, type GstBreakdown } from "@/lib/checkout/gst";
import type { CartItem } from "@/store/cartStore";

export type PricingBreakdown = {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shipping: number;
  gst: GstBreakdown;
  total: number;
};

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

/**
 * Fallback shipping computation used when no live courier rate is available
 * (e.g. before the customer has entered a serviceable pincode).
 */
export function computeFallbackShipping(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_INR
    ? 0
    : STANDARD_SHIPPING_INR;
}

/**
 * Total = discounted merchandise + shipping. Prices are GST-inclusive; the
 * `gst` field breaks out the embedded tax for display / invoicing.
 */
export function computePricing(
  items: CartItem[],
  discount: number,
  shipping?: number
): PricingBreakdown {
  const subtotal = cartSubtotal(items);
  const discountClamped = Math.min(Math.max(0, discount), subtotal);
  const discountedSubtotal = subtotal - discountClamped;
  const shippingResolved =
    typeof shipping === "number" && shipping >= 0
      ? shipping
      : computeFallbackShipping(discountedSubtotal);
  const total = Math.round((discountedSubtotal + shippingResolved) * 100) / 100;

  const gst = computeGstBreakdown(
    items.map((i) => ({ price: i.price, quantity: i.quantity })),
    discountClamped,
    shippingResolved
  );

  return {
    subtotal,
    discount: discountClamped,
    discountedSubtotal,
    shipping: shippingResolved,
    gst,
    total,
  };
}
