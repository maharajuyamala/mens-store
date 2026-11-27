import { describe, it, expect } from "vitest";
import {
  discountFromCoupon,
  evaluateCouponEligibility,
  normalizeCouponCode,
  type CouponDoc,
} from "@/lib/checkout/coupon";

function coupon(overrides: Partial<CouponDoc> = {}): CouponDoc {
  return {
    code: "SAVE10",
    active: true,
    type: "percent",
    value: 10,
    expiresAt: null,
    minSubtotal: 0,
    maxDiscount: null,
    newCustomerOnly: false,
    oncePerCustomer: false,
    usageCount: 0,
    usageLimit: null,
    createdAt: null,
    createdBy: null,
    ...overrides,
  };
}

describe("normalizeCouponCode", () => {
  it("uppercases and strips invalid chars", () => {
    expect(normalizeCouponCode(" save-10! ")).toBe("SAVE-10");
  });
});

describe("discountFromCoupon", () => {
  it("computes a percentage discount", () => {
    expect(discountFromCoupon({ type: "percent", value: 10, maxDiscount: null }, 1000)).toBe(100);
  });
  it("caps a percentage discount at maxDiscount", () => {
    expect(discountFromCoupon({ type: "percent", value: 50, maxDiscount: 100 }, 1000)).toBe(100);
  });
  it("caps a flat discount at the subtotal", () => {
    expect(discountFromCoupon({ type: "amount", value: 5000, maxDiscount: null }, 300)).toBe(300);
  });
});

describe("evaluateCouponEligibility", () => {
  const ctx = { subtotal: 1000, hasUid: true, alreadyRedeemed: false, hasPriorOrders: false };

  it("accepts a valid coupon", () => {
    expect(evaluateCouponEligibility(coupon(), ctx).ok).toBe(true);
  });
  it("rejects inactive", () => {
    const r = evaluateCouponEligibility(coupon({ active: false }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("inactive");
  });
  it("rejects expired", () => {
    const r = evaluateCouponEligibility(coupon({ expiresAt: new Date(Date.now() - 1000) }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("expired");
  });
  it("rejects when the global usage limit is reached", () => {
    const r = evaluateCouponEligibility(coupon({ usageLimit: 2, usageCount: 2 }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("exhausted");
  });
  it("allows below the usage limit", () => {
    expect(evaluateCouponEligibility(coupon({ usageLimit: 5, usageCount: 4 }), ctx).ok).toBe(true);
  });
  it("rejects below minimum subtotal", () => {
    const r = evaluateCouponEligibility(coupon({ minSubtotal: 2000 }), ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("min_subtotal");
  });
  it("blocks restricted coupons for guests", () => {
    const r = evaluateCouponEligibility(coupon({ oncePerCustomer: true }), { ...ctx, hasUid: false });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("guest_not_allowed");
  });
  it("blocks new-customer coupons for returning customers", () => {
    const r = evaluateCouponEligibility(coupon({ newCustomerOnly: true }), { ...ctx, hasPriorOrders: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("new_customer_only");
  });
  it("blocks a second redemption of a once-per-customer coupon", () => {
    const r = evaluateCouponEligibility(coupon({ oncePerCustomer: true }), { ...ctx, alreadyRedeemed: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("already_redeemed");
  });
});
