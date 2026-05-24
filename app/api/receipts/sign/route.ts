import { NextResponse } from "next/server";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import { roleGrantsAdminShell } from "@/lib/auth/roles";
import { buildReceiptPath, RECEIPT_LINK_TTL_MS } from "@/lib/receipts/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mints a 30-day signed receipt link for the given order. The caller must be
 * an authenticated admin (or super admin) — the cashier app calls this right
 * after `placePosSale()` to get a URL they can share with the customer.
 *
 * Body:  { "orderId": "<docId>" }
 * Reply: { "ok": true, "url": "/receipt/...?exp=...&t=...", "expiresAt": <unixMs> }
 *
 * The signing secret lives only on the server. We deliberately don't store
 * the URL — every call re-signs from `orderId` and a fresh exp.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "receipt-sign",
    limit: 60,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

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
      { error: "auth_required", message: "Sign in to mint receipts." },
      { status: 401 }
    );
  }

  let callerUid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json(
      { error: "invalid_token", message: "Bad token." },
      { status: 401 }
    );
  }

  const callerSnap = await db.collection("users").doc(callerUid).get();
  const role =
    callerSnap.exists && typeof callerSnap.data()?.role === "string"
      ? (callerSnap.data()!.role as string)
      : null;
  if (!roleGrantsAdminShell(role)) {
    return NextResponse.json(
      { error: "forbidden", message: "Admin role required." },
      { status: 403 }
    );
  }

  let payload: { orderId?: unknown } = {};
  try {
    payload = (await request.json()) as { orderId?: unknown };
  } catch {
    return NextResponse.json(
      { error: "bad_request", message: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const orderId =
    typeof payload.orderId === "string" ? payload.orderId.trim() : "";
  if (!orderId || !/^[A-Za-z0-9_-]{4,}$/.test(orderId)) {
    return NextResponse.json(
      { error: "bad_request", message: "orderId is required." },
      { status: 400 }
    );
  }

  // Sanity-check the order actually exists so we don't hand out tokens to
  // arbitrary ids.
  const orderSnap = await db.collection("orders").doc(orderId).get();
  if (!orderSnap.exists) {
    return NextResponse.json(
      { error: "not_found", message: "Order not found." },
      { status: 404 }
    );
  }

  const expiresAt = Date.now() + RECEIPT_LINK_TTL_MS;
  const path = buildReceiptPath(orderId, expiresAt);

  return NextResponse.json({ ok: true, path, expiresAt });
}
