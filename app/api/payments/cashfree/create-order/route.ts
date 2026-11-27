import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CashfreeApiError,
  CashfreeNotConfiguredError,
  createCashfreeOrder,
} from "@/lib/payments/cashfree-server";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import {
  OrderValidationError,
  recomputeOrderPricing,
} from "@/lib/server/recompute-pricing";
import { guardWriteRequest } from "@/lib/api/security";
import { COD_ADVANCE_INR } from "@/lib/checkout/constants";
import {
  getPlatformFeeRupees,
  isPlatformFeeEnabled,
} from "@/lib/payments/platform-fee";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
  size: z.string().max(16).optional(),
  color: z.string().max(64).optional(),
});

const customerSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  phone: z.string().regex(/^\d{10}$/),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  discount: z.number().nonnegative().max(1_000_000).optional(),
  mode: z.enum(["full", "advance"]).optional(),
  customer: customerSchema,
  /** Delivery pincode so the server can quote Shiprocket shipping before charging. */
  deliveryPincode: z.string().regex(/^\d{6}$/).optional(),
  /** Full delivery address + coupon, captured before payment so an orphaned
   *  capture (browser closed before /orders/place) can be reconciled or the
   *  order recreated by an admin from the pending snapshot. All optional for
   *  backward compatibility. */
  shippingAddress: z
    .object({
      fullName: z.string().max(120).optional(),
      email: z.string().max(200).optional(),
      phone: z.string().max(20).optional(),
      line1: z.string().max(200).optional(),
      line2: z.string().max(200).optional(),
      city: z.string().max(80).optional(),
      state: z.string().max(80).optional(),
      pincode: z.string().max(10).optional(),
    })
    .optional(),
  couponCode: z.string().max(64).nullable().optional(),
});

/** Cashfree order_id must be unique per merchant, 3-50 chars alphanumeric + _ / -. */
function generateOrderId(): string {
  const buf = new Uint8Array(9);
  crypto.getRandomValues(buf);
  const rand = Array.from(buf)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 12);
  return `sso_${Date.now().toString(36)}_${rand}`;
}

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "cashfree-create",
    limit: 10,
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

  const mode = parsed.mode ?? "full";
  let pricing;
  try {
    pricing = await recomputeOrderPricing(db, parsed.items, {
      discount: parsed.discount ?? 0,
      shippingContext: {
        deliveryPincode: parsed.deliveryPincode,
        cod: mode === "advance",
      },
    });
  } catch (e) {
    if (e instanceof OrderValidationError) {
      return NextResponse.json(
        { error: e.code.toLowerCase(), message: e.message },
        { status: 400 }
      );
    }
    throw e;
  }

  const chargeRupees =
    mode === "advance"
      ? Math.min(COD_ADVANCE_INR, pricing.total)
      : pricing.total;

  if (chargeRupees <= 0) {
    return NextResponse.json(
      { error: "zero_amount", message: "Charge amount is zero — cannot create payment." },
      { status: 400 }
    );
  }

  // Platform fee is bookkeeping-only for now (see lib/payments/platform-fee.ts —
  // Cashfree Split Settlement isn't wired). We still surface the value so the
  // client can display it and the admin earnings view works consistently.
  const platformFeeRupees = isPlatformFeeEnabled()
    ? Math.min(getPlatformFeeRupees(), Math.max(0, chargeRupees - 0.01))
    : 0;

  const orderId = generateOrderId();
  const customerId = `phone_${parsed.customer.phone}`;

  try {
    const order = await createCashfreeOrder({
      orderId,
      amountRupees: chargeRupees,
      customer: {
        id: customerId,
        name: parsed.customer.name,
        email: parsed.customer.email,
        phone: parsed.customer.phone,
      },
      note: `Second Skin — ${mode === "advance" ? "COD advance" : "full payment"}`,
    });

    // Persist a pending-order snapshot keyed by the merchant order_id. If the
    // customer pays but never reaches /orders/place (browser closed, crash),
    // the reconciliation job + admin dashboard can detect the orphaned capture
    // and refund/recreate from this snapshot. Best-effort: never block payment.
    try {
      await db.collection("pending_orders").doc(order.orderId).set({
        cfOrderId: order.cfOrderId,
        orderId: order.orderId,
        mode,
        expectedAmount: chargeRupees,
        items: parsed.items,
        customer: parsed.customer,
        shippingAddress: parsed.shippingAddress ?? null,
        couponCode: parsed.couponCode ?? null,
        deliveryPincode: parsed.deliveryPincode ?? null,
        status: "pending",
        paymentCaptured: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.warn("[cashfree] pending_orders snapshot failed", e);
    }

    return NextResponse.json({
      ok: true,
      cfOrderId: order.cfOrderId,
      orderId: order.orderId,
      paymentSessionId: order.paymentSessionId,
      environment: order.mode,
      mode,
      pricing: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        shipping: pricing.shipping,
        gst: pricing.gst,
        total: pricing.total,
        advancePaid: mode === "advance" ? chargeRupees : 0,
        balanceDue:
          mode === "advance"
            ? Math.round((pricing.total - chargeRupees) * 100) / 100
            : 0,
        platformFee: platformFeeRupees,
      },
    });
  } catch (e) {
    if (e instanceof CashfreeNotConfiguredError) {
      return NextResponse.json(
        { error: "cashfree_not_configured", message: e.message },
        { status: 503 }
      );
    }
    if (e instanceof CashfreeApiError) {
      console.error("[cashfree] create order failed", e);
      return NextResponse.json(
        { error: e.code || "cashfree_create_failed", message: e.message },
        { status: e.status >= 500 ? 502 : 400 }
      );
    }
    console.error("[cashfree] create order failed (unexpected)", e);
    return NextResponse.json(
      {
        error: "cashfree_create_failed",
        message: "Payment provider rejected the order.",
      },
      { status: 502 }
    );
  }
}
