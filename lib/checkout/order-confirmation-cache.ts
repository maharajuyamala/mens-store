import type { OrderShippingRecord } from "@/lib/shiprocket/types";

const KEY = "mens-store-last-order";

export type CachedOrderConfirmation = {
  orderId: string;
  orderNumber: string;
  paymentMethod?: "cod" | "online";
  paymentStatus?: "paid" | "partial" | "due";
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    advancePaid?: number;
    balanceDue?: number;
    couponCode?: string | null;
  };
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
  }>;
  shipping?: OrderShippingRecord;
};

export function writeOrderConfirmation(o: CachedOrderConfirmation): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    // sessionStorage may be unavailable (private mode) — non-fatal.
  }
}

export function readOrderConfirmation(orderId: string): CachedOrderConfirmation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOrderConfirmation;
    return parsed.orderId === orderId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearOrderConfirmation(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
