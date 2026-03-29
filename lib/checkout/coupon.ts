import { doc, getDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/app/firebase";

export type CouponDoc = {
  code: string;
  active: boolean;
  type: "percent" | "fixed";
  value: number;
};

function normalizeCode(code: string): string {
  return code.trim().toUpperCase();
}

function parseCouponData(
  data: Record<string, unknown>,
  fallbackCode: string
): CouponDoc | null {
  const active = data.active === true;
  if (!active) return null;
  const type = data.type === "percent" || data.type === "fixed" ? data.type : null;
  if (!type) return null;
  const value =
    typeof data.value === "number" && !Number.isNaN(data.value)
      ? data.value
      : Number(data.value);
  if (!Number.isFinite(value) || value <= 0) return null;
  const code =
    typeof data.code === "string"
      ? normalizeCode(data.code)
      : fallbackCode;
  if (!code) return null;

  if (type === "percent" && value > 100) return null;

  const exp = data.expiresAt;
  if (exp instanceof Timestamp && exp.toMillis() < Date.now()) return null;

  return { code, active, type, value };
}

/**
 * Load coupon from `coupons/{normalizedCode}` (document id = uppercase code).
 */
export async function fetchCouponByCode(
  rawCode: string
): Promise<CouponDoc | null> {
  const code = normalizeCode(rawCode);
  if (!code) return null;
  const snap = await getDoc(doc(getDb(), "coupons", code));
  if (!snap.exists()) return null;
  return parseCouponData(snap.data() as Record<string, unknown>, code);
}

export function discountFromCoupon(
  coupon: CouponDoc,
  subtotal: number
): number {
  if (subtotal <= 0) return 0;
  if (coupon.type === "percent") {
    return Math.min(
      subtotal,
      Math.round((subtotal * coupon.value) / 100 * 100) / 100
    );
  }
  return Math.min(subtotal, coupon.value);
}
