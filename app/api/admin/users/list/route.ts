import { NextResponse } from "next/server";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import { authorizeSuperAdmin, isAssignableRole } from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Returns every document in `users/`, lightly normalized for the admin UI.
 * Authorized for `super_admin` (Firestore role OR bootstrap allowlist email).
 *
 * GET method to match REST convention, but we still rate-limit via the
 * shared write guard since this is admin tooling that shouldn't be hit at
 * high frequency from the browser anyway.
 */
export async function GET(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "admin-users-list",
    limit: 30,
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
      { error: "auth_required", message: "Sign in as super admin." },
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
  if (!authorizeSuperAdmin({ storedRole, callerEmail })) {
    return NextResponse.json(
      { error: "forbidden", message: "Super admin role required." },
      { status: 403 }
    );
  }

  // Pull the whole users collection. With realistic store volumes (hundreds
  // to a few thousand customers) this is fine; once we cross ~10k accounts
  // we'll paginate via startAfter cursors here.
  const snap = await db
    .collection("users")
    .orderBy("createdAt", "desc")
    .limit(1000)
    .get();

  const users = snap.docs.map((d) => {
    const data = d.data() ?? {};
    const role =
      typeof data.role === "string" && isAssignableRole(data.role)
        ? data.role
        : "user";
    const createdAtMs =
      data.createdAt && typeof data.createdAt.toMillis === "function"
        ? (data.createdAt as { toMillis: () => number }).toMillis()
        : null;
    return {
      id: d.id,
      email: typeof data.email === "string" ? data.email : null,
      displayName:
        typeof data.displayName === "string" ? data.displayName : null,
      photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
      role,
      createdAt: createdAtMs,
      isSelf: d.id === callerUid,
    };
  });

  return NextResponse.json({ ok: true, users });
}
