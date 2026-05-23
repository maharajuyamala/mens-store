import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import {
  ASSIGNABLE_ROLES,
  authorizeSuperAdmin,
  roleIsSuperAdmin,
} from "@/lib/auth/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  userId: z.string().min(1).max(128),
  role: z.enum(ASSIGNABLE_ROLES),
});

/**
 * Change another user's role.
 *
 * Authorization: the caller must be a super_admin — either via their
 * `users/{uid}.role` document or by being in the `SUPER_ADMIN_EMAILS` env
 * allowlist (bootstrap path for the very first super_admin).
 *
 * Guard rails:
 *  - A super_admin cannot demote themselves if they're the *last* one — this
 *    avoids permanently locking the role-management page.
 *  - A super_admin cannot demote another super_admin to a lower role unless
 *    at least one other super_admin remains in the system.
 */
export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "admin-users-role",
    limit: 30,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: e instanceof Error ? e.message : "bad body",
      },
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
  const callerStoredRole =
    callerSnap.exists && typeof callerSnap.data()?.role === "string"
      ? (callerSnap.data()!.role as string)
      : null;
  if (
    !authorizeSuperAdmin({ storedRole: callerStoredRole, callerEmail })
  ) {
    return NextResponse.json(
      { error: "forbidden", message: "Super admin role required." },
      { status: 403 }
    );
  }

  // Look up the target. Refuse to touch missing docs so we don't accidentally
  // create role rows for IDs that aren't real users.
  const targetRef = db.collection("users").doc(parsed.userId);
  const targetSnap = await targetRef.get();
  if (!targetSnap.exists) {
    return NextResponse.json(
      { error: "user_not_found", message: "That user no longer exists." },
      { status: 404 }
    );
  }
  const previousRole =
    typeof targetSnap.data()?.role === "string"
      ? (targetSnap.data()!.role as string)
      : "user";

  if (previousRole === parsed.role) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  // Lockout protection: never let the system end up with zero super_admins.
  const demotingSuper =
    roleIsSuperAdmin(previousRole) && !roleIsSuperAdmin(parsed.role);
  if (demotingSuper) {
    const others = await db
      .collection("users")
      .where("role", "==", "super_admin")
      .get();
    const remaining = others.docs.filter((d) => d.id !== parsed.userId).length;
    if (remaining === 0) {
      return NextResponse.json(
        {
          error: "last_super_admin",
          message:
            "Can't demote the last super admin. Promote someone else first.",
        },
        { status: 409 }
      );
    }
  }

  await targetRef.update({
    role: parsed.role,
    roleUpdatedAt: FieldValue.serverTimestamp(),
    roleUpdatedBy: callerUid,
  });

  return NextResponse.json({
    ok: true,
    userId: parsed.userId,
    previousRole,
    nextRole: parsed.role,
  });
}
