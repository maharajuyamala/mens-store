import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { verifyCashfreeWebhookSignature } from "@/lib/payments/cashfree-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cashfree PG webhook receiver.
 *
 * FAIL-CLOSED by design: until CASHFREE_WEBHOOK_SECRET is configured and the
 * signature scheme is verified against the Cashfree sandbox, every request is
 * rejected (401). This route NEVER creates or fulfils an order on its own —
 * it only records that a payment was captured on the matching pending-order
 * snapshot, so the reconciliation job + admin dashboard can detect an
 * orphaned capture (money taken, no order). Order creation remains the sole
 * responsibility of /api/orders/place (Admin SDK, server-authoritative).
 *
 * Setup: in Cashfree dashboard → Developers → Webhooks, point PAYMENT_SUCCESS
 * (and failure) events at POST {SITE_URL}/api/payments/cashfree/webhook and
 * copy the signing secret into CASHFREE_WEBHOOK_SECRET.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  const timestamp = request.headers.get("x-webhook-timestamp");

  if (!verifyCashfreeWebhookSignature({ timestamp, rawBody, signature })) {
    // Either not configured yet, or a forged/garbled request. Reject.
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 }
    );
  }

  let db;
  try {
    db = requireAdminFirestore();
  } catch (e) {
    if (e instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: "server_not_configured" }, { status: 503 });
    }
    throw e;
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const data = (payload?.data ?? {}) as Record<string, unknown>;
  const order = (data?.order ?? {}) as Record<string, unknown>;
  const payment = (data?.payment ?? {}) as Record<string, unknown>;
  const orderId =
    typeof order.order_id === "string"
      ? order.order_id
      : typeof data.order_id === "string"
        ? (data.order_id as string)
        : null;
  const paymentStatus =
    typeof payment.payment_status === "string" ? payment.payment_status : null;
  const cfPaymentId =
    payment.cf_payment_id != null ? String(payment.cf_payment_id) : null;
  const amount = Number(payment.payment_amount) || null;

  // Only record successful captures; everything else is acknowledged and
  // ignored (idempotent — merge write).
  if (orderId && paymentStatus === "SUCCESS") {
    try {
      await db
        .collection("pending_orders")
        .doc(orderId)
        .set(
          {
            paymentCaptured: true,
            cfPaymentId,
            capturedAmount: amount,
            webhookAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (e) {
      console.error("[cashfree/webhook] persist failed", e);
      // 500 so Cashfree retries delivery.
      return NextResponse.json({ error: "persist_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
