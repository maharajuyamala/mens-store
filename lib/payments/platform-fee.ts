import "server-only";

/**
 * Per-order platform fee bookkeeping.
 *
 * We used to hand the split to Razorpay Route (see git history for the old
 * implementation). Cashfree has an equivalent — Split Settlement / Vendor
 * Accounts — but wiring it requires the developer to be onboarded as a Cashfree
 * vendor first. Until that happens we keep the bookkeeping fields on every
 * order (`platformFee`, `ownerNet`) so the admin's earnings view works, but we
 * do NOT ask Cashfree to split the payment. The developer collects fees out of
 * band.
 *
 * How to enable the actual on-platform split later:
 *   1. Onboard the developer as a Cashfree vendor in the owner's dashboard.
 *   2. Add CASHFREE_VENDOR_ID_DEVELOPER=vendor_XXXXX to the server env.
 *   3. In lib/payments/cashfree-server.ts → createCashfreeOrder, attach the
 *      `order_splits` payload when the env var is set.
 *   4. Remove this file's TODO and set `isPlatformFeeEnabled()` to also return
 *      true when the vendor id is present.
 *
 * Refunds:
 *   The platform fee is non-refundable. Whenever an order is refunded, the
 *   refund amount MUST be capped at `getRefundableAmount(order.pricing)` —
 *   i.e. total minus the platform fee already collected. See
 *   lib/payments/refund-policy.ts (pure math helper).
 */

const DEFAULT_PLATFORM_FEE_INR = 20;

/** Per-order platform fee in rupees. Falls back to ₹20 if env unset/bad. */
export function getPlatformFeeRupees(): number {
  const raw = process.env.PLATFORM_FEE_INR?.trim();
  if (!raw) return DEFAULT_PLATFORM_FEE_INR;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLATFORM_FEE_INR;
  return Math.floor(n);
}

/**
 * True when we should record a platform fee on the order doc. Today this is
 * driven by the presence of PLATFORM_FEE_INR (non-zero). Once Cashfree Split
 * Settlement is wired, additionally require CASHFREE_VENDOR_ID_DEVELOPER.
 */
export function isPlatformFeeEnabled(): boolean {
  return getPlatformFeeRupees() > 0;
}
