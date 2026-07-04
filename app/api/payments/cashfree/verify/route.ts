import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  CashfreeApiError,
  CashfreeNotConfiguredError,
  findSuccessfulPayment,
} from "@/lib/payments/cashfree-server";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  cfOrderId: z.string().min(1).max(100),
});

/**
 * The Drop-in modal calls us with the cf_order_id once it closes. We call
 * Cashfree's REST API (server-to-server, credentialed) to look up the SUCCESS
 * payment for that order. Only if one exists do we write
 * cashfree_payments/{cfPaymentId} and let /api/orders/place trust it.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "cashfree-verify",
    limit: 20,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: e instanceof Error ? e.message : "bad body",
      },
      { status: 400 }
    );
  }

  let db;
  try {
    db = requireAdminFirestore();
  } catch (e) {
    if (e instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { error: "server_not_configured", message: e.message },
        { status: 503 }
      );
    }
    throw e;
  }

  let successPayment;
  try {
    successPayment = await findSuccessfulPayment(parsed.cfOrderId);
  } catch (e) {
    if (e instanceof CashfreeNotConfiguredError) {
      return NextResponse.json(
        { error: "cashfree_not_configured", message: e.message },
        { status: 503 }
      );
    }
    if (e instanceof CashfreeApiError) {
      console.error("[cashfree] verify lookup failed", e);
      return NextResponse.json(
        { error: e.code || "cashfree_lookup_failed", message: e.message },
        { status: e.status >= 500 ? 502 : 400 }
      );
    }
    throw e;
  }

  if (!successPayment) {
    return NextResponse.json(
      {
        error: "payment_not_completed",
        message:
          "No successful payment found for this order. If you were charged, please contact support.",
      },
      { status: 400 }
    );
  }

  try {
    await db
      .collection("cashfree_payments")
      .doc(successPayment.cfPaymentId)
      .set({
        cfOrderId: parsed.cfOrderId,
        cfPaymentId: successPayment.cfPaymentId,
        amount: successPayment.paymentAmount,
        currency: successPayment.paymentCurrency,
        paymentGroup: successPayment.paymentGroup,
        paymentTime: successPayment.paymentTime,
        status: "verified",
        verifiedAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error("[cashfree] verify persist failed", e);
    return NextResponse.json(
      { error: "persist_failed", message: "Could not persist verification." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    cfOrderId: parsed.cfOrderId,
    cfPaymentId: successPayment.cfPaymentId,
  });
}
