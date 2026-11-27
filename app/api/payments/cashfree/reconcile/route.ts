import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import {
  findSuccessfulPayment,
  CashfreeApiError,
  CashfreeNotConfiguredError,
} from "@/lib/payments/cashfree-server";
import { sendTransactionalEmail } from "@/lib/email/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Payment reconciliation sweep. Finds "orphaned captures" — pending orders
 * where the customer paid but no order was ever created (browser closed, crash
 * after Cashfree capture but before /api/orders/place). Alerts the store owner
 * so they can refund (POST /api/payments/cashfree/refund) or recreate the order
 * from the pending snapshot. It does NOT auto-refund or auto-create orders —
 * that stays a deliberate human/manual action to avoid automated money errors.
 *
 * Trigger: a scheduled job (e.g. Vercel Cron) calling this with
 * `Authorization: Bearer ${RECONCILE_CRON_SECRET}`. FAIL-CLOSED: without the
 * secret configured, or with a wrong/absent token, it returns 401 and does
 * nothing.
 */

const AGE_MINUTES = Number(process.env.RECONCILE_MIN_AGE_MIN) || 15;
const MAX_ACTIVE_CHECKS = 25; // cap live Cashfree lookups per run

function authorized(request: Request): boolean {
  const secret = process.env.RECONCILE_CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  return token.length > 0 && token === secret;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
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

  const cutoff = Date.now() - AGE_MINUTES * 60_000;

  // Single-field equality filter → no composite index required.
  const snap = await db
    .collection("pending_orders")
    .where("status", "==", "pending")
    .limit(200)
    .get();

  const orphans: Array<{
    orderId: string;
    amount: number;
    email: string | null;
    cfPaymentId: string | null;
  }> = [];
  let activeChecks = 0;

  for (const doc of snap.docs) {
    const d = doc.data() as Record<string, unknown>;
    const createdAt = d.createdAt as { toMillis?: () => number } | undefined;
    const createdMs =
      createdAt && typeof createdAt.toMillis === "function"
        ? createdAt.toMillis()
        : 0;
    if (createdMs > cutoff) continue; // too fresh — the customer may still finish

    const customer = (d.customer ?? {}) as Record<string, unknown>;
    const email =
      typeof customer.email === "string" ? customer.email : null;
    const expectedAmount = Number(d.expectedAmount) || 0;

    // Captured via webhook → definitely an orphan.
    if (d.paymentCaptured === true) {
      orphans.push({
        orderId: doc.id,
        amount: Number(d.capturedAmount) || expectedAmount,
        email,
        cfPaymentId:
          typeof d.cfPaymentId === "string" ? d.cfPaymentId : null,
      });
      continue;
    }

    // No webhook signal yet — actively ask Cashfree (bounded per run).
    if (activeChecks < MAX_ACTIVE_CHECKS) {
      activeChecks += 1;
      try {
        const pay = await findSuccessfulPayment(doc.id);
        if (pay) {
          orphans.push({
            orderId: doc.id,
            amount: pay.paymentAmount || expectedAmount,
            email,
            cfPaymentId: pay.cfPaymentId,
          });
        }
      } catch (e) {
        if (
          e instanceof CashfreeApiError ||
          e instanceof CashfreeNotConfiguredError
        ) {
          // Skip this one; try again next run.
          continue;
        }
        throw e;
      }
    }
  }

  // Mark alerted so we don't re-alert the same orphans each run.
  if (orphans.length > 0) {
    const batch = db.batch();
    for (const o of orphans) {
      batch.set(
        db.collection("pending_orders").doc(o.orderId),
        { status: "orphan_alerted", orphanAlertedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }
    await batch.commit();

    const to = process.env.ADMIN_ALERT_EMAIL?.trim();
    if (to) {
      const rows = orphans
        .map(
          (o) =>
            `<li>Order <code>${o.orderId}</code> — ₹${o.amount} — ${o.email ?? "no email"} — cfPayment ${o.cfPaymentId ?? "n/a"}</li>`
        )
        .join("");
      await sendTransactionalEmail({
        to,
        subject: `[Action needed] ${orphans.length} paid order(s) with no order created`,
        html: `<p>${orphans.length} customer(s) were charged but no order was created. Refund or recreate from the admin dashboard.</p><ul>${rows}</ul>`,
        text: `${orphans.length} orphaned captures: ${orphans
          .map((o) => `${o.orderId} (₹${o.amount}, ${o.email ?? "no email"})`)
          .join("; ")}`,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    scanned: snap.size,
    orphans: orphans.length,
    alertedEmail: Boolean(process.env.ADMIN_ALERT_EMAIL?.trim()),
  });
}
