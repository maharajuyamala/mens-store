import { describe, it, expect } from "vitest";
import {
  gstRateForPrice,
  extractGst,
  computeGstBreakdown,
  GST_RATE_LOW,
  GST_RATE_HIGH,
} from "@/lib/checkout/gst";

describe("gstRateForPrice", () => {
  it("applies 5% below ₹1000 per piece", () => {
    expect(gstRateForPrice(999)).toBe(GST_RATE_LOW);
    expect(gstRateForPrice(0)).toBe(GST_RATE_LOW);
  });
  it("applies 12% at/above ₹1000 per piece", () => {
    expect(gstRateForPrice(1000)).toBe(GST_RATE_HIGH);
    expect(gstRateForPrice(5000)).toBe(GST_RATE_HIGH);
  });
});

describe("extractGst", () => {
  it("extracts the embedded tax from an inclusive amount", () => {
    expect(extractGst(105, 0.05)).toBe(5);
    expect(extractGst(118, 0.18)).toBe(18);
  });
  it("returns 0 for non-positive inputs", () => {
    expect(extractGst(0, 0.05)).toBe(0);
    expect(extractGst(100, 0)).toBe(0);
  });
});

describe("computeGstBreakdown", () => {
  it("computes merchandise + shipping GST", () => {
    const b = computeGstBreakdown([{ price: 105, quantity: 1 }], 0, 118);
    expect(b.merchandiseGst).toBe(5);
    expect(b.shippingGst).toBe(18);
    expect(b.totalGst).toBe(23);
  });

  it("prorates the discount across lines", () => {
    // 200 inclusive at 5%, 50% discount => taxed on 100 => 100 - 100/1.05 ≈ 4.76
    const b = computeGstBreakdown([{ price: 200, quantity: 1 }], 100, 0);
    expect(b.merchandiseGst).toBeCloseTo(4.76, 2);
  });

  it("never taxes more than the (post-discount) merchandise", () => {
    const b = computeGstBreakdown([{ price: 1000, quantity: 1 }], 0, 0);
    expect(b.merchandiseGst).toBeLessThan(1000);
    expect(b.merchandiseGst).toBeGreaterThan(0);
  });
});
