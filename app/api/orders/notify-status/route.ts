import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { renderOrderStatusEmail } from "@/lib/email/templates";
import { guardWriteRequest } from "@/lib/api/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
});

/**
 * Called by the admin order page after a status update commits. Verifies the
 * caller is an admin (via Firebase ID token + custom-claim-or-Firestore-role
 * check) and sends a notification email to the customer on the order doc.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "notify-status",
    limit: 60,
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

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in as admin." },
      { status: 401 }
    );
  }
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    uid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "invalid_token", message: "Bad token." },
      { status: 401 }
    );
  }

  // Verify admin role from users/{uid}.role (matches firestore.rules logic).
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.data()?.role !== "admin") {
    return NextResponse.json(
      { error: "forbidden", message: "Admin role required." },
      { status: 403 }
    );
  }

  const orderSnap = await db.collection("orders").doc(parsed.orderId).get();
  if (!orderSnap.exists) {
    return NextResponse.json(
      { error: "order_not_found", message: "Order not found." },
      { status: 404 }
    );
  }
  const order = orderSnap.data() as Record<string, unknown>;
  const shippingAddress = (order.shippingAddress ?? {}) as Record<string, unknown>;
  const customerEmail =
    typeof shippingAddress.email === "string" ? shippingAddress.email : "";
  const customerName =
    typeof shippingAddress.fullName === "string"
      ? shippingAddress.fullName
      : "Customer";
  if (!customerEmail) {
    return NextResponse.json({ ok: true, skipped: "no_email" });
  }

  const orderNumber =
    typeof order.orderNumber === "string" ? order.orderNumber : parsed.orderId.slice(0, 6);
  const pricing = (order.pricing ?? {}) as Record<string, number>;
  const itemsRaw = Array.isArray(order.items) ? order.items : [];
  const shipping = (order.shipping ?? {}) as Record<string, unknown>;
  const awbCode = typeof shipping.awbCode === "string" ? shipping.awbCode : null;
  const trackingUrl =
    parsed.status === "shipped" && awbCode
      ? `https://shiprocket.co/tracking/${encodeURIComponent(awbCode)}`
      : undefined;

  const email = renderOrderStatusEmail(
    {
      orderNumber,
      customerName,
      items: itemsRaw.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          name: typeof r.name === "string" ? r.name : "Item",
          quantity:
            typeof r.quantity === "number" ? r.quantity : Number(r.quantity) || 0,
          price: typeof r.price === "number" ? r.price : Number(r.price) || 0,
          size: typeof r.size === "string" ? r.size : undefined,
        };
      }),
      subtotal: Number(pricing.subtotal) || 0,
      discount: Number(pricing.discount) || 0,
      shipping: Number(pricing.shipping) || 0,
      total: Number(pricing.total) || 0,
      paymentMethod:
        typeof order.paymentMethod === "string" ? order.paymentMethod : "cod",
      trackingUrl,
    },
    parsed.status
  );

  const sent = await sendTransactionalEmail({
    to: customerEmail,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  return NextResponse.json({ ok: true, sent });
}
