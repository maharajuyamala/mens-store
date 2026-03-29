import {
  FREE_SHIPPING_THRESHOLD_INR,
  GST_RATE,
  STANDARD_SHIPPING_INR,
} from "@/lib/checkout/constants";
import type { CartItem } from "@/store/cartStore";

export type PricingBreakdown = {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shipping: number;
  gst: number;
  total: number;
};

export function cartSubtotal(items: CartItem[]): number {
  return items.reduce((s, i) => s + i.price * i.quantity, 0);
}

export function computeShipping(subtotalAfterDiscount: number): number {
  if (subtotalAfterDiscount <= 0) return 0;
  return subtotalAfterDiscount >= FREE_SHIPPING_THRESHOLD_INR
    ? 0
    : STANDARD_SHIPPING_INR;
}

/**
 * GST 18% on (discounted merchandise + shipping).
 */
export function computePricing(
  items: CartItem[],
  discount: number
): PricingBreakdown {
  const subtotal = cartSubtotal(items);
  const discountClamped = Math.min(Math.max(0, discount), subtotal);
  const discountedSubtotal = subtotal - discountClamped;
  const shipping = computeShipping(discountedSubtotal);
  const taxable = discountedSubtotal + shipping;
  const gst = Math.round(taxable * GST_RATE * 100) / 100;
  const total = Math.round((taxable + gst) * 100) / 100;

  return {
    subtotal,
    discount: discountClamped,
    discountedSubtotal,
    shipping,
    gst,
    total,
  };
}
