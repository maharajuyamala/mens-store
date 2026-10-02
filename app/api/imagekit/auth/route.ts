import "server-only";
import { NextResponse } from "next/server";
import ImageKit from "@imagekit/nodejs";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import { bootstrapSuperAdminEmails, roleGrantsAdminShell } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let cached: ImageKit | null | undefined;
function getImageKit(): ImageKit | null {
  if (cached !== undefined) return cached;
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    cached = null;
    return cached;
  }
  cached = new ImageKit({ privateKey });
  return cached;
}

export async function GET(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "imagekit-auth",
    limit: 60,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  const ik = getImageKit();
  if (!ik) {
    return NextResponse.json(
      {
        error: "server_not_configured",
        message:
          "ImageKit is not configured. Set IMAGEKIT_PRIVATE_KEY in the server env.",
      },
      { status: 503 }
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
      { error: "auth_required", message: "Sign in as an admin." },
      { status: 401 }
    );
  }

  let callerUid: string;
  let callerEmail: string | null = null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    callerEmail = decoded.email ?? null;
  } catch {
    return NextResponse.json(
      { error: "invalid_token", message: "Bad token." },
      { status: 401 }
    );
  }

  const callerSnap = await db.collection("users").doc(callerUid).get();
  const storedRole =
    callerSnap.exists && typeof callerSnap.data()?.role === "string"
      ? (callerSnap.data()!.role as string)
      : null;
  const email = callerEmail?.trim().toLowerCase();
  const isAdmin =
    roleGrantsAdminShell(storedRole) ||
    (email ? bootstrapSuperAdminEmails().has(email) : false);
  if (!isAdmin) {
    return NextResponse.json(
      { error: "forbidden", message: "Admin role required." },
      { status: 403 }
    );
  }

  const params = ik.helper.getAuthenticationParameters();
  return NextResponse.json({
    ok: true,
    token: params.token,
    expire: params.expire,
    signature: params.signature,
    publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ?? null,
  });
}
