import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import {
  discountFromCoupon,
  evaluateCouponEligibility,
  normalizeCouponCode,
  parseCouponDoc,
} from "@/lib/checkout/coupon";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  code: z.string().min(1).max(64),
  subtotal: z.number().nonnegative().max(10_000_000),
});

/**
 * Validate a coupon for the current cart + user. Returns the computed
 * discount when the coupon is usable, or a friendly error message that
 * the checkout UI can show as-is.
 *
 * Anonymous calls (no bearer token) are still allowed — the coupon may
 * not require sign-in. Restricted coupons (`newCustomerOnly` /
 * `oncePerCustomer`) get a `guest_not_allowed` response in that case so
 * the UI can prompt the customer to sign in.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "coupons-validate",
    limit: 30,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let adminAuth, db;
  try {
    adminAuth = requireAdminAuth();
    db = requireAdminFirestore();
  } catch (e) {
    if (e instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "server_not_configured", message: e.message },
        { status: 503 }
      );
    }
    throw e;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_request",
        message: e instanceof Error ? e.message : "Bad body.",
      },
      { status: 400 }
    );
  }

  const code = normalizeCouponCode(body.code);
  if (!code) {
    return NextResponse.json(
      { ok: false, error: "missing", message: "Enter a coupon code." },
      { status: 400 }
    );
  }

  let uid: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      // Reject a bad token outright — we don't want to silently treat a
      // signed-in customer as a guest because their token expired.
      return NextResponse.json(
        { ok: false, error: "invalid_token", message: "Auth token rejected." },
        { status: 401 }
      );
    }
  }

  const snap = await db.collection("coupons").doc(code).get();
  if (!snap.exists) {
    return NextResponse.json(
      { ok: false, error: "missing", message: "Invalid coupon code." },
      { status: 404 }
    );
  }
  const coupon = parseCouponDoc(snap.data() as Record<string, unknown>, code);
  if (!coupon) {
    return NextResponse.json(
      { ok: false, error: "missing", message: "Invalid coupon code." },
      { status: 404 }
    );
  }

  // Per-user checks — only run when we have a uid.
  let alreadyRedeemed = false;
  let hasPriorOrders = false;
  if (uid) {
    const [redemption, ordersSnap] = await Promise.all([
      coupon.oncePerCustomer
        ? db
            .collection("coupons")
            .doc(code)
            .collection("redemptions")
            .doc(uid)
            .get()
        : Promise.resolve(null),
      coupon.newCustomerOnly
        ? db
            .collection("orders")
            .where("userId", "==", uid)
            .limit(1)
            .get()
        : Promise.resolve(null),
    ]);
    if (redemption?.exists) alreadyRedeemed = true;
    if (ordersSnap && !ordersSnap.empty) hasPriorOrders = true;
  }

  const verdict = evaluateCouponEligibility(coupon, {
    subtotal: body.subtotal,
    hasUid: Boolean(uid),
    alreadyRedeemed,
    hasPriorOrders,
  });
  if (!verdict.ok) {
    return NextResponse.json(
      { ok: false, error: verdict.reason, message: verdict.message },
      { status: 200 } // 200 + ok:false so the client can show the message cleanly
    );
  }

  const discount = discountFromCoupon(coupon, body.subtotal);

  return NextResponse.json({
    ok: true,
    code: coupon.code,
    discount,
    type: coupon.type,
    value: coupon.value,
    maxDiscount: coupon.maxDiscount,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    newCustomerOnly: coupon.newCustomerOnly,
    oncePerCustomer: coupon.oncePerCustomer,
  });
}
