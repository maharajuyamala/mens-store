import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getRazorpay,
  RazorpayNotConfiguredError,
} from "@/lib/payments/razorpay-server";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import {
  OrderValidationError,
  recomputeOrderPricing,
} from "@/lib/server/recompute-pricing";
import { guardWriteRequest } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive().max(50),
  size: z.string().max(16).optional(),
  color: z.string().max(64).optional(),
});

const bodySchema = z.object({
  items: z.array(itemSchema).min(1).max(20),
  discount: z.number().nonnegative().max(1_000_000).optional(),
  /** Short reference shown in Razorpay dashboard; arbitrary string from caller. */
  receipt: z.string().min(1).max(40).optional(),
});

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "razorpay-create",
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

  // Razorpay amounts are in the smallest currency unit (paise for INR).
  const amountInPaise = Math.round(pricing.total * 100);
  if (amountInPaise <= 0) {
    return NextResponse.json(
      { error: "zero_amount", message: "Order total is zero — cannot create payment." },
      { status: 400 }
    );
  }

  try {
    const razorpay = getRazorpay();
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt:
        parsed.receipt ?? `r_${Date.now().toString(36)}`.slice(0, 40),
      payment_capture: true,
    });
    return NextResponse.json({
      ok: true,
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      pricing: {
        subtotal: pricing.subtotal,
        discount: pricing.discount,
        shipping: pricing.shipping,
        total: pricing.total,
      },
    });
  } catch (e) {
    if (e instanceof RazorpayNotConfiguredError) {
      return NextResponse.json(
        { error: "razorpay_not_configured", message: e.message },
        { status: 503 }
      );
    }
    console.error("[razorpay] create order failed", e);
    return NextResponse.json(
      { error: "razorpay_create_failed", message: "Payment provider rejected the order." },
      { status: 502 }
    );
  }
}
