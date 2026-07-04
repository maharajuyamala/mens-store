import { NextResponse } from "next/server";
import { z } from "zod";
import {
  CashfreeApiError,
  CashfreeNotConfiguredError,
  createCashfreeOrder,
} from "@/lib/payments/cashfree-server";
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

  let pricing;
  try {
    pricing = await recomputeOrderPricing(db, parsed.items, {
      discount: parsed.discount ?? 0,
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

  const mode = parsed.mode ?? "full";
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
