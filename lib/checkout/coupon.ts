import { doc, getDoc, Timestamp } from "firebase/firestore";
import { getDb } from "@/app/firebase";

/**
 * Coupon model stored at `coupons/{CODE}` (doc id = canonical uppercase code).
 *
 * `type: "percent"` uses `value` as a percentage (0–100); optional
 * `maxDiscount` caps the absolute rupee discount so a 50% offer on a big
 * cart doesn't blow up. `type: "amount"` is a flat rupee discount, capped
 * at the cart subtotal.
 *
 * Eligibility rules:
 *   - `expiresAt`        — link goes dead after this Timestamp.
 *   - `minSubtotal`      — only valid above a certain cart subtotal.
 *   - `newCustomerOnly`  — only valid when the user has 0 prior orders.
 *   - `oncePerCustomer`  — each user (uid) can redeem at most once.
 *
 * Eligibility is validated server-side (`/api/coupons/validate`) so the
 * client UI never decides whether a customer is "new" or has already
 * redeemed — both checks are easy to spoof from the browser.
 */
export type CouponDoc = {
  code: string;
  active: boolean;
  type: "percent" | "amount";
  value: number;
  expiresAt: Date | null;
  minSubtotal: number;
  maxDiscount: number | null;
  newCustomerOnly: boolean;
  oncePerCustomer: boolean;
  usageCount: number;
  createdAt: Date | null;
  createdBy: { uid: string; email: string | null } | null;
};

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate();
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (v && typeof v === "object" && "toDate" in v) {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function readNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Best-effort parse from a raw Firestore doc. Returns null only when the
 * data is so broken the coupon can't be reasoned about (no type / value).
 * Callers should still check `active` + `expiresAt` before using it.
 */
export function parseCouponDoc(
  data: Record<string, unknown>,
  fallbackCode: string
): CouponDoc | null {
  const codeRaw =
    typeof data.code === "string" ? data.code : fallbackCode;
  const code = normalizeCouponCode(codeRaw);
  if (!code) return null;

  // Accept legacy "fixed" as a synonym for "amount" so old docs keep working.
  const rawType = data.type;
  const type: "percent" | "amount" | null =
    rawType === "percent"
      ? "percent"
      : rawType === "amount" || rawType === "fixed"
        ? "amount"
        : null;
  if (!type) return null;

  const value = readNumber(data.value, NaN);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (type === "percent" && value > 100) return null;

  const maxDiscountRaw = data.maxDiscount;
  const maxDiscount =
    maxDiscountRaw == null
      ? null
      : (() => {
          const n = readNumber(maxDiscountRaw, NaN);
          return Number.isFinite(n) && n > 0 ? n : null;
        })();

  const createdBy =
    data.createdBy && typeof data.createdBy === "object"
      ? (() => {
          const c = data.createdBy as Record<string, unknown>;
          if (typeof c.uid !== "string") return null;
          return {
            uid: c.uid,
            email: typeof c.email === "string" ? c.email : null,
          };
        })()
      : null;

  return {
    code,
    active: data.active === true,
    type,
    value,
    expiresAt: toDate(data.expiresAt),
    minSubtotal: Math.max(0, readNumber(data.minSubtotal, 0)),
    maxDiscount,
    newCustomerOnly: data.newCustomerOnly === true,
    oncePerCustomer: data.oncePerCustomer === true,
    usageCount: Math.max(0, Math.floor(readNumber(data.usageCount, 0))),
    createdAt: toDate(data.createdAt),
    createdBy,
  };
}

/** Compute the discount this coupon would apply to a given subtotal. */
export function discountFromCoupon(
  coupon: Pick<CouponDoc, "type" | "value" | "maxDiscount">,
  subtotal: number
): number {
  if (subtotal <= 0) return 0;
  let raw: number;
  if (coupon.type === "percent") {
    raw = Math.round(((subtotal * coupon.value) / 100) * 100) / 100;
  } else {
    raw = coupon.value;
  }
  if (coupon.maxDiscount != null && raw > coupon.maxDiscount) {
    raw = coupon.maxDiscount;
  }
  return Math.min(subtotal, Math.max(0, raw));
}

export type CouponIneligibility =
  | "missing"
  | "inactive"
  | "expired"
  | "min_subtotal"
  | "new_customer_only"
  | "already_redeemed"
  | "guest_not_allowed";

export type EligibilityContext = {
  /** Cart subtotal before discount, in INR. */
  subtotal: number;
  /** True when caller is signed-in. Required for new-customer / once rules. */
  hasUid: boolean;
  /** True when this user has already redeemed this coupon (server-checked). */
  alreadyRedeemed: boolean;
  /** True when this signed-in user has at least one prior order. */
  hasPriorOrders: boolean;
};

export function evaluateCouponEligibility(
  coupon: CouponDoc,
  ctx: EligibilityContext
): { ok: true } | { ok: false; reason: CouponIneligibility; message: string } {
  if (!coupon.active) {
    return { ok: false, reason: "inactive", message: "This coupon isn't active." };
  }
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired", message: "This coupon has expired." };
  }
  if (coupon.minSubtotal > 0 && ctx.subtotal < coupon.minSubtotal) {
    return {
      ok: false,
      reason: "min_subtotal",
      message: `Add ${formatINR(coupon.minSubtotal - ctx.subtotal)} more to use this coupon.`,
    };
  }
  if ((coupon.newCustomerOnly || coupon.oncePerCustomer) && !ctx.hasUid) {
    return {
      ok: false,
      reason: "guest_not_allowed",
      message: "Sign in to use this coupon.",
    };
  }
  if (coupon.newCustomerOnly && ctx.hasPriorOrders) {
    return {
      ok: false,
      reason: "new_customer_only",
      message: "This coupon is for new customers only.",
    };
  }
  if (coupon.oncePerCustomer && ctx.alreadyRedeemed) {
    return {
      ok: false,
      reason: "already_redeemed",
      message: "You've already used this coupon.",
    };
  }
  return { ok: true };
}

function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Math.ceil(n));
}

/**
 * Client-side coupon lookup. Returns the parsed doc (or null if missing /
 * malformed). Does NOT check user-specific eligibility — call the server
 * `/api/coupons/validate` endpoint for that.
 */
export async function fetchCouponByCode(
  rawCode: string
): Promise<CouponDoc | null> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const snap = await getDoc(doc(getDb(), "coupons", code));
  if (!snap.exists()) return null;
  return parseCouponDoc(snap.data() as Record<string, unknown>, code);
}
