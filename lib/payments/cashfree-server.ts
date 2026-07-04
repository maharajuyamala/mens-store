import "server-only";

/**
 * Server-side wrapper around Cashfree PG (v3). We use the REST API directly via
 * fetch — the 3 endpoints we need (create order, list payments, get order) are
 * simpler than pulling in the official SDK. Verification of a successful
 * payment is done server-to-server by re-fetching the order's payments from
 * Cashfree after the Drop-in modal closes, which is the authoritative source
 * of truth.
 */

export class CashfreeNotConfiguredError extends Error {
  constructor() {
    super("Cashfree is not configured. Set CASHFREE_APP_ID and CASHFREE_SECRET_KEY.");
    this.name = "CashfreeNotConfiguredError";
  }
}

export class CashfreeApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "CashfreeApiError";
  }
}

const API_VERSION = "2023-08-01";

export type CashfreeMode = "sandbox" | "production";

function readMode(): CashfreeMode {
  const raw = process.env.CASHFREE_ENVIRONMENT?.trim().toLowerCase();
  return raw === "production" ? "production" : "sandbox";
}

/** Public helper: safe to call without secrets. Used to tell the client which
 *  Cashfree SDK mode to load. */
export function getCashfreeMode(): CashfreeMode {
  return readMode();
}

function getConfig(): {
  appId: string;
  secret: string;
  mode: CashfreeMode;
  baseUrl: string;
} {
  const appId = process.env.CASHFREE_APP_ID?.trim();
  const secret = process.env.CASHFREE_SECRET_KEY?.trim();
  if (!appId || !secret) throw new CashfreeNotConfiguredError();
  const mode = readMode();
  const baseUrl =
    mode === "production"
      ? "https://api.cashfree.com/pg"
      : "https://sandbox.cashfree.com/pg";
  return { appId, secret, mode, baseUrl };
}

async function cashfreeFetch<T>(
  path: string,
  opts: RequestInit
): Promise<T> {
  const cfg = getConfig();
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...opts,
    headers: {
      "x-api-version": API_VERSION,
      "x-client-id": cfg.appId,
      "x-client-secret": cfg.secret,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(opts.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response body
  }
  if (!res.ok) {
    const err = (json ?? {}) as Record<string, unknown>;
    const message =
      typeof err.message === "string"
        ? err.message
        : `Cashfree ${path} failed (HTTP ${res.status}).`;
    const code = typeof err.code === "string" ? err.code : "cashfree_error";
    throw new CashfreeApiError(res.status, code, message);
  }
  return (json ?? {}) as T;
}

export type CashfreeCreateOrderInput = {
  /** Merchant-generated unique id. Cashfree allows 3-50 chars, alphanumeric + underscore + hyphen. */
  orderId: string;
  amountRupees: number;
  customer: {
    /** Any string that identifies the customer (uid, phone hash, etc.). */
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  returnUrl?: string;
  note?: string;
};

export type CashfreeCreateOrderResult = {
  cfOrderId: string;
  orderId: string;
  paymentSessionId: string;
  orderStatus: string;
  mode: CashfreeMode;
};

export async function createCashfreeOrder(
  input: CashfreeCreateOrderInput
): Promise<CashfreeCreateOrderResult> {
  const body: Record<string, unknown> = {
    order_id: input.orderId,
    order_amount: Number(input.amountRupees.toFixed(2)),
    order_currency: "INR",
    customer_details: {
      customer_id: input.customer.id,
      customer_phone: input.customer.phone,
      customer_name: input.customer.name,
      customer_email: input.customer.email,
    },
  };
  if (input.returnUrl) {
    body.order_meta = { return_url: input.returnUrl };
  }
  if (input.note) body.order_note = input.note;

  const data = await cashfreeFetch<Record<string, unknown>>(`/orders`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const paymentSessionId =
    typeof data.payment_session_id === "string" ? data.payment_session_id : "";
  if (!paymentSessionId) {
    throw new CashfreeApiError(
      502,
      "no_session",
      "Cashfree did not return a payment session id."
    );
  }
  return {
    cfOrderId: String(data.cf_order_id ?? ""),
    orderId: typeof data.order_id === "string" ? data.order_id : input.orderId,
    paymentSessionId,
    orderStatus:
      typeof data.order_status === "string" ? data.order_status : "UNKNOWN",
    mode: readMode(),
  };
}

export type CashfreePayment = {
  cfPaymentId: string;
  orderId: string;
  /** One of SUCCESS, FAILED, PENDING, USER_DROPPED, VOID, CANCELLED, NOT_ATTEMPTED. */
  paymentStatus: string;
  paymentAmount: number;
  paymentCurrency: string;
  /** Human-readable payment mode (upi / card / net_banking / wallet / …), or null. */
  paymentGroup: string | null;
  paymentTime: string | null;
};

/** GET /pg/orders/{order_id}/payments — every payment attempt on the order. */
export async function listCashfreePayments(
  orderId: string
): Promise<CashfreePayment[]> {
  const data = await cashfreeFetch<unknown>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { method: "GET" }
  );
  const arr = Array.isArray(data) ? data : [];
  return arr.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      cfPaymentId: String(r.cf_payment_id ?? ""),
      orderId: String(r.order_id ?? orderId),
      paymentStatus: String(r.payment_status ?? "UNKNOWN"),
      paymentAmount: Number(r.payment_amount ?? 0),
      paymentCurrency: String(r.payment_currency ?? "INR"),
      paymentGroup:
        typeof r.payment_group === "string" ? r.payment_group : null,
      paymentTime:
        typeof r.payment_time === "string" ? r.payment_time : null,
    };
  });
}

/**
 * Find the successful payment for a Cashfree order. Called by
 * /api/payments/cashfree/verify — this is the authoritative check that the
 * customer actually paid (server-to-server, credentials required, cannot be
 * spoofed by the browser). Returns null when no SUCCESS attempt exists.
 */
export async function findSuccessfulPayment(
  orderId: string
): Promise<CashfreePayment | null> {
  const payments = await listCashfreePayments(orderId);
  return payments.find((p) => p.paymentStatus === "SUCCESS") ?? null;
}
