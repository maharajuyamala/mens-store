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

  // For online payment, require a verified Razorpay reference — otherwise reject.
  // (The /api/payments/razorpay/verify route writes the verification under
  // razorpay_payments/{paymentId} so we can re-confirm it here.)
  if (parsed.paymentMethod === "online") {
    if (!parsed.payment?.razorpayPaymentId) {
      return NextResponse.json(
        { error: "payment_required", message: "Online orders require a verified payment reference." },
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
  }

  // Recompute pricing server-side. Discount is capped at subtotal.
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
    console.error("[orders/place] pricing failed", e);
    return NextResponse.json(
      { error: "pricing_failed", message: "Could not price your order. Try again." },
      { status: 500 }
    );
  }

  const orderNumber = generateOrderNumber();
  const orderRef = db.collection("orders").doc();

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
      couponCode: parsed.couponCode ?? null,
    },
    status: "pending",
    paymentMethod: parsed.paymentMethod,
    paymentStatus: parsed.paymentMethod === "online" ? "paid" : "due",
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

      const totalsByProduct = new Map<
        string,
        { totalQty: number; bySize: Map<string, number> }
      >();
      for (const line of pricing.lines) {
        const entry = totalsByProduct.get(line.productId) ?? {
          totalQty: 0,
          bySize: new Map<string, number>(),
        };
        entry.totalQty += line.quantity;
        if (line.size) {
          entry.bySize.set(line.size, (entry.bySize.get(line.size) ?? 0) + line.quantity);
        }
        totalsByProduct.set(line.productId, entry);
      }

      for (const snap of snaps) {
        if (!snap.exists) {
          throw new OrderValidationError(
            "MISSING_PRODUCT",
            `Product ${snap.id} disappeared mid-checkout.`
          );
        }
        const data = snap.data() as Record<string, unknown>;
        const totals = totalsByProduct.get(snap.id);
        if (!totals) continue;

        const patch: Record<string, unknown> = {};
        const sizesRaw = data.sizes;
        if (sizesRaw && typeof sizesRaw === "object" && !Array.isArray(sizesRaw)) {
          const nextMap: Record<string, number> = {};
          for (const [k, v] of Object.entries(sizesRaw as Record<string, unknown>)) {
            const n =
              typeof v === "number" ? v : Number(typeof v === "string" ? v : 0);
            nextMap[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
          }
          for (const [size, qty] of totals.bySize) {
            if (!(size in nextMap)) {
              throw new OrderValidationError(
                "INSUFFICIENT_STOCK",
                `Size ${size} is no longer offered for this product.`
              );
            }
            if (nextMap[size]! < qty) {
              throw new OrderValidationError(
                "INSUFFICIENT_STOCK",
                `Size ${size}: only ${nextMap[size]} left.`
              );
            }
            nextMap[size] = nextMap[size]! - qty;
          }
          patch.sizes = nextMap;
          patch.stock = Object.values(nextMap).reduce((s, n) => s + n, 0);
        } else {
          const stock =
            typeof data.stock === "number"
              ? data.stock
              : Number(data.stock) || 0;
          if (stock < totals.totalQty) {
            throw new OrderValidationError(
              "INSUFFICIENT_STOCK",
              `Only ${stock} units left.`
            );
          }
          patch.stock = stock - totals.totalQty;
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
      couponCode: parsed.couponCode ?? null,
    },
    items: pricing.lines,
  });
}

// Silence unused import warning for Timestamp — kept available for future status history fields.
void Timestamp;
