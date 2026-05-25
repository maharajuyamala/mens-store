/**
 * Refund policy helpers — pure functions, safe to import on both client
 * and server. The companion file `platform-fee.ts` is server-only
 * because it reads env vars; this one stays universal so admin UIs can
 * display "Refundable amount" without round-tripping to the server.
 *
 * Core policy: the developer's platform fee is non-refundable. Whenever
 * a refund is issued (manual today, automated tomorrow), the refund
 * amount must be capped at `getRefundableAmount(order.pricing)`.
 */

export type RefundablePricing = {
  total?: unknown;
  platformFee?: unknown;
  ownerNet?: unknown;
};

function readMoney(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.max(0, n);
  }
  return 0;
}

/**
 * Maximum amount that may be refunded to the customer for an order.
 * Equals `total - platformFee`, i.e. only the owner's share is
 * refundable. Falls back to the full total when no platform fee is
 * recorded (legacy orders placed before Route was wired up).
 */
export function getRefundableAmount(pricing: RefundablePricing): number {
  const total = readMoney(pricing?.total);
  const ownerNet = readMoney(pricing?.ownerNet);
  if (ownerNet > 0) return Math.min(ownerNet, total);
  const fee = readMoney(pricing?.platformFee);
  return Math.max(0, Math.round((total - fee) * 100) / 100);
}

/** Platform fee component, normalized to a number. */
export function getPlatformFee(pricing: RefundablePricing): number {
  return readMoney(pricing?.platformFee);
}
