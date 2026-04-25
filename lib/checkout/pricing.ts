import {
  FREE_SHIPPING_THRESHOLD_INR,
  STANDARD_SHIPPING_INR,
} from "@/lib/checkout/constants";
import type { CartItem } from "@/store/cartStore";

export type PricingBreakdown = {
  subtotal: number;
  discount: number;
  discountedSubtotal: number;
  shipping: number;
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

/** Total = discounted merchandise + shipping (no separate GST line). */
export function computePricing(
  items: CartItem[],
  discount: number
): PricingBreakdown {
  const subtotal = cartSubtotal(items);
  const discountClamped = Math.min(Math.max(0, discount), subtotal);
  const discountedSubtotal = subtotal - discountClamped;
  const shipping = computeShipping(discountedSubtotal);
  const total = Math.round((discountedSubtotal + shipping) * 100) / 100;

  return {
    subtotal,
    discount: discountClamped,
    discountedSubtotal,
    shipping,
    total,
  };
}
