import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue, Timestamp, type UpdateData } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import {
  OrderValidationError,
  recomputeOrderPricing,
} from "@/lib/server/recompute-pricing";
import { guardWriteRequest } from "@/lib/api/security";
import { COD_ADVANCE_INR } from "@/lib/checkout/constants";
import {
  discountFromCoupon,
  evaluateCouponEligibility,
  normalizeCouponCode,
  parseCouponDoc,
} from "@/lib/checkout/coupon";
import {
  getPlatformFeeRupees,
  isRouteConfigured,
} from "@/lib/payments/platform-fee";
import {
  decrementLegacyStock,
  decrementVariantStock,
  hasVariantStock,
  VariantStockError,
} from "@/lib/products/variant-stock-write";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { renderOrderConfirmationEmail } from "@/lib/email/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateOrderNumber(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ORDER_CHARS[buf[i]! % ORDER_CHARS.length];
  }
  return s;
}

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
  size: z.string().max(16).optional(),
  color: z.string().max(64).optional(),
});

const addressSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10}$/),
  line1: z.string().min(3).max(200),
  line2: z.string().max(200).optional(),
  city: z.string().min(2).max(80),
  state: z.string().min(2).max(80),
  pincode: z.string().regex(/^\d{6}$/),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  shippingAddress: addressSchema,
  paymentMethod: z.enum(["cod", "online"]),
  couponCode: z.string().max(64).nullable().optional(),
  /** Optional client-computed discount; server caps it but does not trust the value blindly. */
  discount: z.number().nonnegative().max(1_000_000).optional(),
  /** Optional Razorpay verified payment reference (for "online" only). */
  payment: z
    .object({
      razorpayOrderId: z.string(),
      razorpayPaymentId: z.string(),
      verifiedAt: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "orders-place",
    limit: 10,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
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
      return NextResponse.json(
        { error: "server_not_configured", message: e.message },
        { status: 503 }
      );
    }
    throw e;
  }

  // Optional auth — guests are allowed to check out. If a token is present, verify it.
  let uid: string | null = null;
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      return NextResponse.json(
        { error: "invalid_token", message: "Auth token rejected." },
        { status: 401 }
      );
    }
  }

  // Both "online" (full) and "cod" (advance) require a verified Razorpay reference.
  // (The /api/payments/razorpay/verify route writes the verification under
  // razorpay_payments/{paymentId} so we can re-confirm it here.)
  if (!parsed.payment?.razorpayPaymentId) {
    return NextResponse.json(
      {
        error: "payment_required",
        message:
          parsed.paymentMethod === "online"
            ? "Online orders require a verified payment reference."
            : "COD orders require an online advance payment.",
      },
      { status: 400 }
    );
  }
  try {
    const snap = await db
      .collection("razorpay_payments")
      .doc(parsed.payment.razorpayPaymentId)
      .get();
    if (!snap.exists) {
      return NextResponse.json(
        { error: "payment_not_verified", message: "Payment reference not found." },
        { status: 400 }
      );
    }
    const data = snap.data();
    if (data?.status !== "verified") {
      return NextResponse.json(
        { error: "payment_not_verified", message: "Payment signature was not verified." },
        { status: 400 }
      );
    }
  } catch (e) {
    console.error("[orders/place] payment lookup failed", e);
    return NextResponse.json(
      { error: "payment_lookup_failed", message: "Could not verify payment." },
      { status: 500 }
    );
  }

  // Resolve coupon server-side. If a code is supplied, ignore the
  // client-quoted discount entirely and recompute from the live coupon
  // doc + user eligibility. This is the only place a redemption gets
  // counted.
  const requestedCode = parsed.couponCode
    ? normalizeCouponCode(parsed.couponCode)
    : "";
  let resolvedCoupon: {
    code: string;
    discount: number;
    type: "percent" | "amount";
    value: number;
    oncePerCustomer: boolean;
    newCustomerOnly: boolean;
  } | null = null;

  if (requestedCode) {
    const couponSnap = await db.collection("coupons").doc(requestedCode).get();
    if (!couponSnap.exists) {
      return NextResponse.json(
        { error: "coupon_invalid", message: "Coupon code is no longer valid." },
        { status: 400 }
      );
    }
    const coupon = parseCouponDoc(
      couponSnap.data() as Record<string, unknown>,
      requestedCode
    );
    if (!coupon) {
      return NextResponse.json(
        { error: "coupon_invalid", message: "Coupon code is no longer valid." },
        { status: 400 }
      );
    }

    // We need the cart subtotal before applying any discount to evaluate
    // the min-subtotal rule. Do a quick pricing pass with discount=0.
    let provisional;
    try {
      provisional = await recomputeOrderPricing(db, parsed.items, { discount: 0 });
    } catch (e) {
      if (e instanceof OrderValidationError) {
        return NextResponse.json(
          { error: e.code.toLowerCase(), message: e.message },
          { status: 400 }
        );
      }
      throw e;
    }

    let alreadyRedeemed = false;
    let hasPriorOrders = false;
    if (uid) {
      const [redemption, ordersSnap] = await Promise.all([
        coupon.oncePerCustomer
          ? db
              .collection("coupons")
              .doc(requestedCode)
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
      subtotal: provisional.subtotal,
      hasUid: Boolean(uid),
      alreadyRedeemed,
      hasPriorOrders,
    });
    if (!verdict.ok) {
      return NextResponse.json(
        { error: `coupon_${verdict.reason}`, message: verdict.message },
        { status: 400 }
      );
    }

    resolvedCoupon = {
      code: coupon.code,
      discount: discountFromCoupon(coupon, provisional.subtotal),
      type: coupon.type,
      value: coupon.value,
      oncePerCustomer: coupon.oncePerCustomer,
      newCustomerOnly: coupon.newCustomerOnly,
    };
  }

  // Recompute pricing server-side. When a coupon resolved, use its
  // discount; otherwise fall back to any client-supplied discount (which
  // recomputeOrderPricing already clamps to the subtotal).
  let pricing;
  try {
    pricing = await recomputeOrderPricing(db, parsed.items, {
      discount: resolvedCoupon ? resolvedCoupon.discount : parsed.discount ?? 0,
    });
  } catch (e) {
    if (e instanceof OrderValidationError) {
      return NextResponse.json(
        { error: e.code.toLowerCase(), message: e.message },
        { status: 400 }
      );
    }
    console.error("[orders/place] pricing failed", e);
    return NextResponse.json(
      { error: "pricing_failed", message: "Could not price your order. Try again." },
      { status: 500 }
    );
  }

  const orderNumber = generateOrderNumber();
  const orderRef = db.collection("orders").doc();

  const advancePaid =
    parsed.paymentMethod === "cod"
      ? Math.min(COD_ADVANCE_INR, pricing.total)
      : pricing.total;
  const balanceDue =
    Math.round((pricing.total - advancePaid) * 100) / 100;

  // Platform fee comes out of the amount we actually collected online
  // (full total for "online", advance for "cod"). Razorpay Route does
  // the actual split at capture time — we just record it here for
  // bookkeeping and the admin's "earnings" view.
  const onlineCharge =
    parsed.paymentMethod === "online" ? pricing.total : advancePaid;
  const platformFeeRupees = isRouteConfigured()
    ? Math.min(getPlatformFeeRupees(), Math.max(0, onlineCharge - 0.01))
    : 0;
  const ownerNet = Math.max(
    0,
    Math.round((pricing.total - platformFeeRupees) * 100) / 100
  );
  const paymentStatus =
    parsed.paymentMethod === "online"
      ? "paid"
      : balanceDue > 0
        ? "partial"
        : "paid";

  const orderDoc: Record<string, unknown> = {
    userId: uid ?? "guest",
    orderNumber,
    items: pricing.lines,
    shippingAddress: parsed.shippingAddress,
    pricing: {
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      total: pricing.total,
      advancePaid,
      balanceDue,
      couponCode: resolvedCoupon?.code ?? null,
      platformFee: platformFeeRupees,
      ownerNet,
    },
    status: "pending",
    paymentMethod: parsed.paymentMethod,
    paymentStatus,
    createdAt: FieldValue.serverTimestamp(),
    shipping: {
      provider: "shiprocket",
      status: "pending",
      createdAt: new Date().toISOString(),
    },
  };
  if (parsed.payment?.razorpayPaymentId) {
    orderDoc.payment = {
      provider: "razorpay",
      razorpayOrderId: parsed.payment.razorpayOrderId,
      razorpayPaymentId: parsed.payment.razorpayPaymentId,
      verifiedAt: parsed.payment.verifiedAt ?? new Date().toISOString(),
    };
  }

  // Transaction: re-read each product (avoid TOCTOU) and decrement stock atomically.
  try {
    await db.runTransaction(async (tx) => {
      const productRefs = pricing.lines.map((l) =>
        db.collection("products").doc(l.productId)
      );
      const snaps = await Promise.all(productRefs.map((r) => tx.get(r)));

      // Group lines so we apply one patch per product, with each (color,size,qty)
      // available individually for the variant-aware decrement path.
      const linesByProduct = new Map<
        string,
        Array<{ color: string; size: string; quantity: number }>
      >();
      for (const line of pricing.lines) {
        const list = linesByProduct.get(line.productId) ?? [];
        list.push({
          color: line.color || "",
          size: line.size || "",
          quantity: line.quantity,
        });
        linesByProduct.set(line.productId, list);
      }

      for (const snap of snaps) {
        if (!snap.exists) {
          throw new OrderValidationError(
            "MISSING_PRODUCT",
            `Product ${snap.id} disappeared mid-checkout.`
          );
        }
        const data = snap.data() as Record<string, unknown>;
        const productLines = linesByProduct.get(snap.id);
        if (!productLines) continue;

        let patch: Record<string, unknown>;
        try {
          patch = hasVariantStock(data)
            ? decrementVariantStock(data, productLines)
            : decrementLegacyStock(data, productLines);
        } catch (err) {
          if (err instanceof VariantStockError) {
            const name =
              typeof data.name === "string" ? data.name : "A product";
            throw new OrderValidationError(
              "INSUFFICIENT_STOCK",
              `${name}: ${err.message}`
            );
          }
          throw err;
        }
        tx.update(snap.ref, patch as UpdateData<Record<string, unknown>>);
      }

      tx.set(orderRef, orderDoc);
      if (uid) {
        const userOrderRef = db
          .collection("users")
          .doc(uid)
          .collection("orders")
          .doc(orderRef.id);
        tx.set(userOrderRef, orderDoc);
      }

      // Coupon bookkeeping inside the same transaction so the redemption
      // either commits with the order or doesn't get recorded at all.
      // - Always bump the global usage counter.
      // - Record a per-user redemption doc when the customer is signed in,
      //   which is what enforces `oncePerCustomer` going forward.
      if (resolvedCoupon) {
        const couponRef = db.collection("coupons").doc(resolvedCoupon.code);
        tx.update(couponRef, {
          usageCount: FieldValue.increment(1),
          lastRedeemedAt: FieldValue.serverTimestamp(),
        });
        if (uid) {
          const redemptionRef = couponRef
            .collection("redemptions")
            .doc(uid);
          tx.set(redemptionRef, {
            uid,
            orderId: orderRef.id,
            orderNumber,
            amount: pricing.discount,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
    });
  } catch (e) {
    if (e instanceof OrderValidationError) {
      return NextResponse.json(
        { error: e.code.toLowerCase(), message: e.message },
        { status: 409 }
      );
    }
    console.error("[orders/place] transaction failed", e);
    return NextResponse.json(
      { error: "order_failed", message: "Could not place your order. Please try again." },
      { status: 500 }
    );
  }

  // Fire-and-forget order confirmation email. No retry; if Resend errors, the
  // order itself still succeeded — admin can resend from the dashboard later.
  void (async () => {
    const email = renderOrderConfirmationEmail({
      orderNumber,
      customerName: parsed.shippingAddress.fullName,
      items: pricing.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        price: l.price,
        size: l.size || undefined,
      })),
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      total: pricing.total,
      advancePaid,
      balanceDue,
      paymentMethod: parsed.paymentMethod,
    });
    await sendTransactionalEmail({
      to: parsed.shippingAddress.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
  })();

  return NextResponse.json({
    ok: true,
    orderId: orderRef.id,
    orderNumber,
    pricing: {
      subtotal: pricing.subtotal,
      discount: pricing.discount,
      shipping: pricing.shipping,
      total: pricing.total,
      advancePaid,
      balanceDue,
      couponCode: resolvedCoupon?.code ?? null,
      platformFee: platformFeeRupees,
      ownerNet,
    },
    paymentMethod: parsed.paymentMethod,
    paymentStatus,
    items: pricing.lines,
  });
}

// Silence unused import warning for Timestamp — kept available for future status history fields.
void Timestamp;
