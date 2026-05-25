import "server-only";

/**
 * Razorpay Route integration for splitting platform fees between the store
 * owner and the developer.
 *
 * Flow:
 *   - Store owner's Razorpay account is the primary merchant of record.
 *   - Developer is registered as a "Linked Account" in the owner's
 *     dashboard (Razorpay Route → Linked Accounts). Razorpay issues an
 *     account id like `acc_XXXXXXXXXXXXXX`; that goes in
 *     RAZORPAY_LINKED_ACCOUNT_DEVELOPER.
 *   - On every Razorpay order we create, we attach a `transfers` array
 *     telling Razorpay to send PLATFORM_FEE_INR to the developer's
 *     linked account when the payment is captured. The remainder stays
 *     with the owner and settles to their bank as usual.
 *
 * Behavior when env vars are unset:
 *   - `isRouteConfigured()` returns false → orders are created without
 *     `transfers`. The site keeps working in single-account mode for
 *     local dev / sandboxes that don't have Route activated yet.
 *
 * Refunds:
 *   - **The platform fee is non-refundable.** Whenever an order is
 *     refunded (manually in the Razorpay dashboard today, or via an
 *     automated route in future), the refund amount must be capped at
 *     `getRefundableAmount(order.pricing)` — i.e. total minus the
 *     platform fee already settled to the developer. The developer
 *     keeps their fee regardless of whether the order is cancelled.
 *   - For Razorpay Route specifically, this means refunds MUST NOT set
 *     `reverse_all: 1` (which would claw back the linked-account
 *     transfer). Use `reverse_all: 0` (the default) and pass the
 *     reduced amount.
 */

const DEFAULT_PLATFORM_FEE_INR = 20;

export type PlatformTransfer = {
  account: string;
  amount: number; // in paise
  currency: "INR";
  notes?: Record<string, string>;
  on_hold?: 0 | 1;
};

export function getDeveloperLinkedAccountId(): string | null {
  const v = process.env.RAZORPAY_LINKED_ACCOUNT_DEVELOPER?.trim();
  return v && v.startsWith("acc_") ? v : null;
}

/** Per-order platform fee in rupees. Falls back to ₹20 if env unset/bad. */
export function getPlatformFeeRupees(): number {
  const raw = process.env.PLATFORM_FEE_INR?.trim();
  if (!raw) return DEFAULT_PLATFORM_FEE_INR;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_PLATFORM_FEE_INR;
  return Math.floor(n);
}

export function isRouteConfigured(): boolean {
  return getDeveloperLinkedAccountId() !== null;
}

/**
 * Build the `transfers` payload for `razorpay.orders.create()`. Returns
 * null when Route is not configured (caller should omit the field
 * entirely in that case — Razorpay rejects an empty transfers array).
 *
 * The fee is clamped so we never try to send more than (chargedAmount -
 * 1 paise) to the linked account. That handles edge cases like a tiny
 * cart total or a coupon driving the charge under the fee value. When
 * the charge is so small the fee would round to zero, we skip the
 * transfer entirely.
 */
export function buildOrderTransfers(
  chargedAmountInPaise: number,
  notes?: Record<string, string>
): { transfers: PlatformTransfer[]; feeInPaise: number } | null {
  const account = getDeveloperLinkedAccountId();
  if (!account) return null;
  if (chargedAmountInPaise <= 0) return null;

  const requestedFeeInPaise = getPlatformFeeRupees() * 100;
  if (requestedFeeInPaise <= 0) return null;

  // Leave at least 1 paise for the owner. In practice we don't allow
  // sub-fee orders to happen, but be defensive.
  const feeInPaise = Math.min(requestedFeeInPaise, chargedAmountInPaise - 1);
  if (feeInPaise <= 0) return null;

  return {
    feeInPaise,
    transfers: [
      {
        account,
        amount: feeInPaise,
        currency: "INR",
        notes: { purpose: "platform_fee", ...notes },
        on_hold: 0,
      },
    ],
  };
}

// `getRefundableAmount` is the pure-math sibling — lives in a non-`server-only`
// module so the admin UI (a client component) can use it too. See
// lib/payments/refund-policy.ts.
