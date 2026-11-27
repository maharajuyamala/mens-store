import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import { roleGrantsAdminShell } from "@/lib/auth/roles";
import {
  refundCashfreePayment,
  CashfreeApiError,
  CashfreeNotConfiguredError,
} from "@/lib/payments/cashfree-server";
import { getRefundableAmount } from "@/lib/payments/refund-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Firestore order document id. */
  orderId: z.string().min(1).max(128),
  /** Optional partial amount; defaults to the full refundable amount. */
  amount: z.number().positive().max(10_000_000).optional(),
  note: z.string().max(200).optional(),
});

/**
 * Admin-triggered refund. Capped at the order's refundable amount
 * (total − non-refundable platform fee). Idempotent per order: a second call
 * is rejected once a non-failed refund is recorded. This is a deliberate
 * manual action — there is no automated refund path.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "cashfree-refund",
    limit: 20,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_request", message: e instanceof Error ? e.message : "bad body" },
      { status: 400 }
    );
  }

  let adminAuth, db;
  try {
    adminAuth = requireAdminAuth();
    db = requireAdminFirestore();
  } catch (e) {
    if (e instanceof AdminNotConfiguredError) {
      return NextResponse.json({ error: "server_not_configured", message: e.message }, { status: 503 });
    }
    throw e;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "auth_required", message: "Sign in as admin." }, { status: 401 });
  }
  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "invalid_token", message: "Bad token." }, { status: 401 });
  }
  const callerSnap = await db.collection("users").doc(callerUid).get();
  const callerRole =
    typeof callerSnap.data()?.role === "string" ? (callerSnap.data()!.role as string) : null;
  if (!roleGrantsAdminShell(callerRole)) {
    return NextResponse.json({ error: "forbidden", message: "Admin role required." }, { status: 403 });
  }

  const orderRef = db.collection("orders").doc(parsed.orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) {
    return NextResponse.json({ error: "order_not_found", message: "Order not found." }, { status: 404 });
  }
  const order = orderSnap.data() as Record<string, unknown>;

  // Idempotency: refuse a second refund unless the prior one failed.
  const existing = order.refund as Record<string, unknown> | undefined;
  if (existing && typeof existing.status === "string" && existing.status.toUpperCase() !== "FAILED") {
    return NextResponse.json(
      { error: "already_refunded", message: "This order has already been refunded.", refund: existing },
      { status: 409 }
    );
  }

  const payment = (order.payment ?? {}) as Record<string, unknown>;
  const cashfreeOrderId = typeof payment.orderId === "string" ? payment.orderId : null;
  if (!cashfreeOrderId) {
    return NextResponse.json(
      { error: "no_payment", message: "No Cashfree payment reference on this order." },
      { status: 400 }
    );
  }

  const refundable = getRefundableAmount(order.pricing as never);
  if (refundable <= 0) {
    return NextResponse.json({ error: "nothing_refundable", message: "Nothing is refundable on this order." }, { status: 400 });
  }
  const amount = Math.min(parsed.amount ?? refundable, refundable);

  const refundId = `${parsed.orderId}-r${Date.now().toString(36)}`;
  try {
    const result = await refundCashfreePayment({
      orderId: cashfreeOrderId,
      amountRupees: amount,
      refundId,
      note: parsed.note ?? `Refund for order ${order.orderNumber ?? parsed.orderId}`,
    });

    await orderRef.set(
      {
        refund: {
          refundId: result.refundId,
          cfRefundId: result.cfRefundId,
          amount,
          status: result.status,
          by: callerUid,
          at: FieldValue.serverTimestamp(),
        },
        paymentStatus: "refunded",
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, orderId: parsed.orderId, amount, status: result.status });
  } catch (e) {
    if (e instanceof CashfreeNotConfiguredError) {
      return NextResponse.json({ error: "cashfree_not_configured", message: e.message }, { status: 503 });
    }
    if (e instanceof CashfreeApiError) {
      console.error("[cashfree/refund] failed", e);
      return NextResponse.json(
        { error: e.code || "refund_failed", message: e.message },
        { status: e.status >= 500 ? 502 : 400 }
      );
    }
    console.error("[cashfree/refund] unexpected", e);
    return NextResponse.json({ error: "refund_failed", message: "Refund could not be processed." }, { status: 502 });
  }
}
