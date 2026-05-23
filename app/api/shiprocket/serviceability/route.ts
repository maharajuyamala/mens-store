import { NextResponse } from "next/server";
import { z } from "zod";
import { shiprocketGet, ShiprocketError } from "@/lib/shiprocket/client";
import { guardWriteRequest } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  pickupPincode: z.string().regex(/^\d{6}$/),
  deliveryPincode: z.string().regex(/^\d{6}$/),
  weightKg: z.number().positive().max(50).default(0.5),
  cod: z.boolean().default(true),
});

type ShiprocketServiceabilityResponse = {
  status?: number;
  data?: {
    available_courier_companies?: Array<{
      courier_company_id?: number;
      courier_name?: string;
      etd?: string;
      cod?: 0 | 1;
    }>;
  };
};

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "serviceability",
    limit: 30,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof querySchema>;
  try {
    const body = await request.json();
    parsed = querySchema.parse(body);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_request", message: e instanceof Error ? e.message : "bad input" },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({
    pickup_postcode: parsed.pickupPincode,
    delivery_postcode: parsed.deliveryPincode,
    weight: String(parsed.weightKg),
    cod: parsed.cod ? "1" : "0",
  });

  try {
    const result = await shiprocketGet<ShiprocketServiceabilityResponse>(
      `/courier/serviceability/?${params.toString()}`
    );
    const couriers = result?.data?.available_courier_companies ?? [];
    const serviceable = couriers.length > 0;
    return NextResponse.json({
      ok: true,
      serviceable,
      courierCount: couriers.length,
      // Hand back a tiny excerpt for debugging only — never the full list.
      sample: couriers.slice(0, 1).map((c) => ({
        name: c.courier_name,
        etd: c.etd,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serviceability check failed";
    const status = e instanceof ShiprocketError ? e.status : 502;
    console.error("[shiprocket] serviceability failed", e);
    // Fail open: if Shiprocket itself is down, do not block checkout on the customer's side.
    // The order placement step will still try and surface a real error.
    return NextResponse.json(
      { ok: false, serviceable: true, error: message, failOpen: true },
      { status: status >= 500 ? 200 : status }
    );
  }
}
