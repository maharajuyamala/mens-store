import { describe, it, expect } from "vitest";
import { allowedNextStatuses } from "@/lib/admin/orders-admin";
import { getRefundableAmount, getPlatformFee } from "@/lib/payments/refund-policy";

describe("allowedNextStatuses (order state machine)", () => {
  it("pending can go to processing or cancelled", () => {
    expect(allowedNextStatuses("pending").sort()).toEqual(["cancelled", "pending", "processing"]);
  });
  it("processing can go to shipped or cancelled", () => {
    expect(allowedNextStatuses("processing").sort()).toEqual(["cancelled", "processing", "shipped"]);
  });
  it("shipped can go to delivered or cancelled", () => {
    expect(allowedNextStatuses("shipped").sort()).toEqual(["cancelled", "delivered", "shipped"]);
  });
  it("cancelled is terminal", () => {
    expect(allowedNextStatuses("cancelled")).toEqual(["cancelled"]);
  });
  it("delivered can only be cancelled (e.g. post-delivery return)", () => {
    expect(allowedNextStatuses("delivered").sort()).toEqual(["cancelled", "delivered"]);
  });
});

describe("getRefundableAmount", () => {
  it("uses ownerNet when present", () => {
    expect(getRefundableAmount({ total: 100, ownerNet: 80, platformFee: 20 })).toBe(80);
  });
  it("falls back to total - platformFee", () => {
    expect(getRefundableAmount({ total: 100, platformFee: 20 })).toBe(80);
  });
  it("refunds the full total for legacy orders with no fee", () => {
    expect(getRefundableAmount({ total: 100 })).toBe(100);
  });
  it("never goes negative", () => {
    expect(getRefundableAmount({ total: 10, platformFee: 50 })).toBe(0);
  });
});

describe("getPlatformFee", () => {
  it("normalizes a numeric fee", () => {
    expect(getPlatformFee({ platformFee: 20 })).toBe(20);
    expect(getPlatformFee({})).toBe(0);
  });
});
