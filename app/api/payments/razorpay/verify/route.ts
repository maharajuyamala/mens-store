import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  RazorpayNotConfiguredError,
  verifyRazorpaySignature,
} from "@/lib/payments/razorpay-server";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

/**
 * Razorpay handler hits this with the order/payment IDs and signature returned
 * by the checkout SDK. We verify the HMAC, persist a tiny record at
 * `razorpay_payments/{paymentId}` and the /api/orders/place route then trusts
 * the presence of that doc with status=verified.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "razorpay-verify",
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

  let valid: boolean;
  try {
    valid = verifyRazorpaySignature({
      orderId: parsed.razorpayOrderId,
      paymentId: parsed.razorpayPaymentId,
      signature: parsed.razorpaySignature,
    });
  } catch (e) {
    if (e instanceof RazorpayNotConfiguredError) {
      return NextResponse.json(
        { error: "razorpay_not_configured", message: e.message },
        { status: 503 }
      );
    }
    throw e;
  }

  if (!valid) {
    return NextResponse.json(
      { error: "invalid_signature", message: "Payment signature mismatch." },
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

  try {
    await db
      .collection("razorpay_payments")
      .doc(parsed.razorpayPaymentId)
      .set({
        razorpayOrderId: parsed.razorpayOrderId,
        razorpayPaymentId: parsed.razorpayPaymentId,
        status: "verified",
        verifiedAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    console.error("[razorpay] verify persist failed", e);
    return NextResponse.json(
      { error: "persist_failed", message: "Could not persist verification." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
