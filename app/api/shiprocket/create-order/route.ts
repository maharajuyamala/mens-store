import { NextResponse } from "next/server";
import { z } from "zod";
import {
  buildShiprocketPayload,
  type BuildPayloadInput,
} from "@/lib/shiprocket/buildPayload";
import { createAdhocOrder, ShiprocketError } from "@/lib/shiprocket/client";
import type { OrderShippingRecord } from "@/lib/shiprocket/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1),
  price: z.number().nonnegative(),
  quantity: z.number().int().positive(),
  size: z.string().optional(),
  color: z.string().optional(),
});

const addressSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  line1: z.string().min(3),
  line2: z.string().optional(),
  city: z.string().min(2),
  state: z.string().min(2),
  pincode: z.string().regex(/^\d{6}$/),
});

const pricingSchema = z.object({
  subtotal: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  total: z.number().nonnegative(),
});

const bodySchema = z.object({
  orderNumber: z.string().regex(/^[A-Z0-9]{6,16}$/),
  paymentMethod: z.enum(["cod", "online"]),
  items: z.array(itemSchema).min(1),
  shippingAddress: addressSchema,
  pricing: pricingSchema,
});

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await request.json();
    parsed = bodySchema.parse(json);
  } catch (e) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: e instanceof Error ? e.message : "Invalid request body",
      },
      { status: 400 }
    );
  }

  const input: BuildPayloadInput = {
    ...parsed,
    createdAt: new Date(),
  };

  try {
    const payload = buildShiprocketPayload(input);
    const result = await createAdhocOrder(payload);

    const record: OrderShippingRecord = {
      provider: "shiprocket",
      status: "created",
      shiprocketOrderId: result.order_id,
      shipmentId: result.shipment_id,
      awbCode: result.awb_code ?? null,
      courierName: result.courier_name ?? null,
      createdAt: new Date().toISOString(),
    };
    return NextResponse.json({ ok: true, shipping: record });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Shiprocket request failed";
    const status = e instanceof ShiprocketError ? e.status : 502;
    console.error("[shiprocket] create-order failed", e);
    const record: OrderShippingRecord = {
      provider: "shiprocket",
      status: "failed",
      createdAt: new Date().toISOString(),
      error: message,
    };
    return NextResponse.json(
      { ok: false, error: message, shipping: record },
      { status }
    );
  }
}
