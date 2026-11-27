import { NextResponse } from "next/server";
import {
  buildShiprocketPayload,
  type BuildPayloadInput,
} from "@/lib/shiprocket/buildPayload";
import { createAdhocOrder, ShiprocketError } from "@/lib/shiprocket/client";
import type { OrderShippingRecord } from "@/lib/shiprocket/types";
import { guardWriteRequest } from "@/lib/api/security";
import {
  AdminNotConfiguredError,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Book a Shiprocket shipment for an EXISTING order.
 *
 * Security: this route no longer trusts client-supplied address/items (that let
 * anyone book real shipments to arbitrary addresses). It resolves the real
 * order from Firestore by its orderNumber and builds the courier payload from
 * the server-stored data. It is idempotent (won't double-book) and writes the
 * resulting shipping record back to the order server-side — which also fixes
 * guest orders, whose client can't update the order doc under the rules.
 */

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}
function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "create-order",
    limit: 10,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let rawBody: { orderNumber?: unknown };
  try {
    rawBody = (await request.json()) as { orderNumber?: unknown };
  } catch {
    return NextResponse.json(
      { error: "invalid_request", message: "Invalid request body" },
      { status: 400 }
    );
  }
  const orderNumber = str(rawBody?.orderNumber);
  if (!/^[A-Z0-9]{6,16}$/.test(orderNumber)) {
    return NextResponse.json(
      { error: "invalid_request", message: "A valid orderNumber is required." },
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

  // Resolve the real order — never trust client-supplied address/items.
  const q = await db
    .collection("orders")
    .where("orderNumber", "==", orderNumber)
    .limit(1)
    .get();
  if (q.empty) {
    return NextResponse.json(
      { error: "order_not_found", message: "No order matches that number." },
      { status: 404 }
    );
  }
  const orderDoc = q.docs[0]!;
  const order = orderDoc.data() as Record<string, unknown>;

  // Idempotent: if already booked, return the existing record.
  const existing = order.shipping as Record<string, unknown> | undefined;
  if (existing && existing.status === "created") {
    return NextResponse.json({ ok: true, shipping: existing, alreadyBooked: true });
  }

  const addr = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const itemsRaw = Array.isArray(order.items) ? order.items : [];
  const pricing = (order.pricing ?? {}) as Record<string, unknown>;
  const paymentMethod: "cod" | "online" =
    order.paymentMethod === "cod" ? "cod" : "online";

  if (itemsRaw.length === 0 || !str(addr.pincode)) {
    return NextResponse.json(
      { error: "order_incomplete", message: "Order is missing items or address." },
      { status: 422 }
    );
  }

  const input: BuildPayloadInput = {
    orderNumber,
    createdAt: new Date(),
    paymentMethod,
    items: itemsRaw.map((raw) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      return {
        productId: str(r.productId) || undefined,
        name: str(r.name, "Item"),
        price: num(r.price),
        quantity: Math.max(1, Math.floor(num(r.quantity, 1))),
        size: str(r.size) || undefined,
        color: str(r.color) || undefined,
      };
    }),
    shippingAddress: {
      fullName: str(addr.fullName, "Customer"),
      email: str(addr.email),
      phone: str(addr.phone),
      line1: str(addr.line1),
      line2: str(addr.line2) || undefined,
      city: str(addr.city),
      state: str(addr.state),
      pincode: str(addr.pincode),
    },
    pricing: {
      subtotal: num(pricing.subtotal),
      discount: num(pricing.discount),
      shipping: num(pricing.shipping),
      total: num(pricing.total),
      advancePaid: num(pricing.advancePaid),
    },
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

    // Persist authoritatively (works for guests too — Admin SDK bypasses rules).
    await orderDoc.ref.set({ shipping: record }, { merge: true });
    const uid = str(order.userId, "guest");
    if (uid !== "guest") {
      await db
        .collection("users")
        .doc(uid)
        .collection("orders")
        .doc(orderDoc.id)
        .set({ shipping: record }, { merge: true })
        .catch(() => {});
    }

    return NextResponse.json({ ok: true, shipping: record });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Shiprocket request failed";
    const status = e instanceof ShiprocketError ? e.status || 502 : 502;
    console.error("[shiprocket] create-order failed", e);
    const record: OrderShippingRecord = {
      provider: "shiprocket",
      status: "failed",
      createdAt: new Date().toISOString(),
      error: message,
    };
    await orderDoc.ref.set({ shipping: record }, { merge: true }).catch(() => {});
    return NextResponse.json({ ok: false, error: message, shipping: record }, { status });
  }
}
