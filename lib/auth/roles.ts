/**
 * Role tiers used across the app.
 *
 *  - `user`        — default. Storefront only.
 *  - `supervisor`  — tagged tier for store staff (currently used for reporting;
 *                    no privileged screens yet — extend as we add them).
 *  - `admin`       — full storefront admin (products, inventory, orders, etc.).
 *  - `super_admin` — admin + can change other users' roles via /admin/users.
 *
 * Storage: `users/{uid}.role`. The client never writes this field directly
 * (Firestore rules forbid it); only the Admin SDK via `/api/admin/users/role`.
 *
 * Bootstrap: a `SUPER_ADMIN_EMAILS` env variable lists the email addresses
 * that the role-change API will accept as super_admin even before their
 * Firestore doc has been elevated. This is how the first super_admin is
 * created — sign in with that email, open `/admin/users`, and promote
 * yourself (or anyone else). Once a Firestore role is set, the env variable
 * is only used as a fallback.
 */

export const ASSIGNABLE_ROLES = ["user", "supervisor", "admin", "super_admin"] as const;
export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABEL: Record<AssignableRole, string> = {
  user: "Customer",
  supervisor: "Supervisor",
  admin: "Admin",
  super_admin: "Super admin",
};

export const ROLE_DESCRIPTION: Record<AssignableRole, string> = {
  user: "Default. Can shop, wishlist, place orders.",
  supervisor: "Staff tag. Tracked role for store ops.",
  admin: "Full admin: products, orders, inventory.",
  super_admin: "Admin + can change user roles.",
};

export function isAssignableRole(value: unknown): value is AssignableRole {
  return (
    typeof value === "string" &&
    (ASSIGNABLE_ROLES as readonly string[]).includes(value)
  );
}

/** True when this role unlocks the admin shell (read /admin/* pages). */
export function roleGrantsAdminShell(role: string | null | undefined): boolean {
  return role === "admin" || role === "super_admin";
}

/** True when this role can change other users' roles. */
export function roleIsSuperAdmin(role: string | null | undefined): boolean {
  return role === "super_admin";
}

/**
 * Bootstrap allowlist read from `SUPER_ADMIN_EMAILS` (comma-separated).
 * Returns lowercase emails, no-op on the server when unset. The list is
 * intentionally small — meant for the founder + maybe one ops lead.
 */
export function bootstrapSuperAdminEmails(): Set<string> {
  const raw = process.env.SUPER_ADMIN_EMAILS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * Authorize a caller as super-admin. Accepts the caller iff:
 *   1. their Firestore `users/{uid}.role` is `super_admin`, OR
 *   2. their email is in the `SUPER_ADMIN_EMAILS` env allowlist.
 *
 * Caller passes the data so this stays a pure function (easy to test and
 * reuse from API routes).
 */
export function authorizeSuperAdmin(input: {
  storedRole: string | null | undefined;
  callerEmail: string | null | undefined;
}): boolean {
  if (roleIsSuperAdmin(input.storedRole)) return true;
  const email = input.callerEmail?.trim().toLowerCase();
  if (!email) return false;
  return bootstrapSuperAdminEmails().has(email);
}
