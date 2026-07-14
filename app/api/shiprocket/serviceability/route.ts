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

type ShiprocketCourier = {
  courier_company_id?: number;
  courier_name?: string;
  etd?: string;
  cod?: 0 | 1;
  rate?: number | string;
  freight_charge?: number | string;
};

type ShiprocketServiceabilityResponse = {
  status?: number;
  data?: {
    available_courier_companies?: ShiprocketCourier[];
  };
};

function readRate(c: ShiprocketCourier): number | null {
  const raw = c.rate ?? c.freight_charge;
  if (raw === undefined || raw === null) return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

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

    // ADVISORY ONLY: we used to hard-block when Shiprocket returned 0 couriers,
    // but that produces false negatives whenever the Shiprocket account is
    // misconfigured (no active pickup address for the chosen pickup PIN, no
    // courier partners enabled for the route, COD not enabled, weight band
    // rejects, etc.). The real authority on "can we ship this" is the actual
    // /orders/create/adhoc call later. Surface a diagnostic in the logs so the
    // owner can fix the account config, but always tell the client to proceed.
    if (couriers.length === 0) {
      console.warn(
        `[shiprocket] zero couriers for pickup=${parsed.pickupPincode} delivery=${parsed.deliveryPincode} cod=${parsed.cod ? 1 : 0} weight=${parsed.weightKg}kg. ` +
          "Likely Shiprocket account config: pickup address inactive, no couriers enabled, or COD disabled. " +
          "Allowing checkout to proceed (order placement is the real check)."
      );
      return NextResponse.json({
        ok: true,
        serviceable: true,
        courierCount: 0,
        failOpen: true,
        reason: "no_couriers_returned",
      });
    }

    // Pick the cheapest quoted courier. Shiprocket sometimes returns entries
    // without a rate (channel-specific rate cards) — those get skipped.
    let cheapest: { name?: string; etd?: string; rate: number } | null = null;
    for (const c of couriers) {
      const rate = readRate(c);
      if (rate === null) continue;
      if (!cheapest || rate < cheapest.rate) {
        cheapest = { name: c.courier_name, etd: c.etd, rate };
      }
    }

    return NextResponse.json({
      ok: true,
      serviceable: true,
      courierCount: couriers.length,
      cheapest,
      sample: couriers.slice(0, 1).map((c) => ({
        name: c.courier_name,
        etd: c.etd,
      })),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Serviceability check failed";
    const status = e instanceof ShiprocketError ? e.status : 502;
    console.error("[shiprocket] serviceability failed", e);
    // Same philosophy: never block the customer on a probe failure.
    return NextResponse.json(
      { ok: false, serviceable: true, error: message, failOpen: true },
      { status: status >= 500 ? 200 : status }
    );
  }
}
