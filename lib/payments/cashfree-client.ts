/// <reference types="node" />

/**
 * Cashfree PG browser-side checkout helper (Drop-in / JS SDK).
 *
 * Flow:
 *   1. POST /api/payments/cashfree/create-order — server creates a Cashfree
 *      order and returns a payment_session_id.
 *   2. Load @cashfreepayments/cashfree-js and call cashfree.checkout({
 *        paymentSessionId, redirectTarget: "_modal" }).
 *   3. When the modal closes (success, failure, or user dismissed) POST
 *      /api/payments/cashfree/verify — server calls Cashfree API to
 *      authoritatively confirm the SUCCESS payment, persists the reference,
 *      and returns { orderId, cfPaymentId }.
 */

import { load } from "@cashfreepayments/cashfree-js";

export type CashfreeCheckoutInput = {
  items: Array<{
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
  }>;
  discount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  /** Delivery pincode so the server can quote Shiprocket shipping before charging. */
  deliveryPincode?: string;
  /**
   * "full" (default) — collect the full order total online.
   * "advance" — collect only the COD prepayment; the rest is collected by courier.
   */
  mode?: "full" | "advance";
};

export type CashfreeCheckoutResult = {
  /** Merchant order_id we generated on the server (looks like `sso_...`). */
  orderId: string;
  /** Cashfree's payment_id for the successful attempt (used as Firestore doc id). */
  cfPaymentId: string;
};

export class CashfreeCheckoutError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CashfreeCheckoutError";
  }
}

type CreateOrderOk = {
  ok: true;
  paymentSessionId: string;
  cfOrderId: string;
  orderId: string;
  environment: "sandbox" | "production";
};

type VerifyOk = {
  ok: true;
  orderId: string;
  cfPaymentId: string;
};

// The @cashfreepayments/cashfree-js checkout() return type is loose; we treat
// it as an unknown object and inspect for an "error" field. Success = no error;
// the source of truth is the server-side verify call.
type CheckoutOutcome = {
  error?: { code?: string; message?: string } | null;
} | undefined;

export async function runCashfreeCheckout(
  input: CashfreeCheckoutInput
): Promise<CashfreeCheckoutResult> {
  const createRes = await fetch("/api/payments/cashfree/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: input.items,
      discount: input.discount,
      mode: input.mode ?? "full",
      customer: input.customer,
      deliveryPincode: input.deliveryPincode,
    }),
  });
  const createJson = (await createRes.json().catch(() => null)) as
    | CreateOrderOk
    | { error?: string; message?: string }
    | null;
  if (!createRes.ok || !createJson || !("ok" in createJson) || !createJson.ok) {
    const code =
      (createJson && "error" in createJson && createJson.error) ||
      "create_failed";
    const message =
      (createJson && "message" in createJson && createJson.message) ||
      "Could not start payment.";
    throw new CashfreeCheckoutError(code, message);
  }

  let cashfree;
  try {
    cashfree = await load({ mode: createJson.environment });
  } catch (e) {
    throw new CashfreeCheckoutError(
      "sdk_load_failed",
      e instanceof Error ? e.message : "Cashfree SDK failed to load."
    );
  }

  let outcome: CheckoutOutcome;
  try {
    outcome = (await cashfree.checkout({
      paymentSessionId: createJson.paymentSessionId,
      redirectTarget: "_modal",
    })) as CheckoutOutcome;
  } catch (e) {
    throw new CashfreeCheckoutError(
      "checkout_threw",
      e instanceof Error ? e.message : "Payment could not be started."
    );
  }

  if (outcome?.error) {
    const code = outcome.error.code ?? "checkout_error";
    const message = outcome.error.message ?? "Payment was not completed.";
    // Cashfree returns 'user_dropped' or 'payment_cancelled' when the modal is
    // closed without paying — map both to our shared 'dismissed' code so the
    // checkout page can show a friendly "Payment cancelled" toast.
    if (code === "user_dropped" || code === "payment_cancelled") {
      throw new CashfreeCheckoutError("dismissed", message);
    }
    throw new CashfreeCheckoutError(code, message);
  }

  const verifyRes = await fetch("/api/payments/cashfree/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: createJson.orderId }),
  });
  const verifyJson = (await verifyRes.json().catch(() => null)) as
    | VerifyOk
    | { error?: string; message?: string }
    | null;
  if (
    !verifyRes.ok ||
    !verifyJson ||
    !("ok" in verifyJson) ||
    !verifyJson.ok
  ) {
    const code =
      (verifyJson && "error" in verifyJson && verifyJson.error) ||
      "verify_failed";
    const message =
      (verifyJson && "message" in verifyJson && verifyJson.message) ||
      "Payment verification failed.";
    throw new CashfreeCheckoutError(code, message);
  }

  return {
    orderId: verifyJson.orderId,
    cfPaymentId: verifyJson.cfPaymentId,
  };
}
