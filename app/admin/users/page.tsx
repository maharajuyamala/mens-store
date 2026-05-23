"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ChevronDown,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getFirebaseAuth } from "@/app/firebase";
import { useAuth } from "@/hooks/useAuth";
import {
  ASSIGNABLE_ROLES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  type AssignableRole,
} from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type AdminUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role: AssignableRole;
  createdAt: number | null;
  isSelf: boolean;
};

const ROLE_FILTERS: Array<{ value: "all" | AssignableRole; label: string }> = [
  { value: "all", label: "All" },
  { value: "super_admin", label: "Super admin" },
  { value: "admin", label: "Admin" },
  { value: "supervisor", label: "Supervisor" },
  { value: "user", label: "Customer" },
];

function roleBadgeClass(role: AssignableRole): string {
  switch (role) {
    case "super_admin":
      return "bg-orange-500/20 text-orange-200 border-orange-500/40";
    case "admin":
      return "bg-emerald-500/20 text-emerald-200 border-emerald-500/40";
    case "supervisor":
      return "bg-sky-500/20 text-sky-200 border-sky-500/40";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function timeAgo(ms: number | null): string {
  if (!ms) return "—";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  const days = Math.floor(diff / 86_400_000);
  if (days < 31) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function initialsOf(name: string | null, email: string | null): string {
  const src = (name || email || "?").trim();
  return src
    .split(/[\s@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export default function AdminUsersPage() {
  const { user, isSuperAdmin, loading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AssignableRole>("all");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  /**
   * The API is the source of truth (it uses the Admin SDK to bypass the
   * "read-your-own-doc-only" rule and honours the SUPER_ADMIN_EMAILS
   * bootstrap). We don't subscribe; super_admin role changes are rare enough
   * that a manual refresh after each mutation is plenty.
   */
  const fetchUsers = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/users/list", {
        method: "GET",
        headers: { authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const json = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        users?: AdminUser[];
        message?: string;
      };
      if (!res.ok || !json.ok || !json.users) {
        throw new Error(
          json.message ?? `Could not load users (${res.status}).`
        );
      }
      setUsers(json.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load users.");
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;
    if (!isSuperAdmin) {
      // Try to load anyway — the API also accepts SUPER_ADMIN_EMAILS bootstrap
      // callers whose Firestore role isn't elevated yet.
      void fetchUsers();
      return;
    }
    void fetchUsers();
  }, [loading, isSuperAdmin, fetchUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter !== "all" && u.role !== filter) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.displayName ?? "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, search, filter]);

  const counts = useMemo(() => {
    const total = users.length;
    const by: Record<AssignableRole, number> = {
      user: 0,
      supervisor: 0,
      admin: 0,
      super_admin: 0,
    };
    for (const u of users) by[u.role] = (by[u.role] ?? 0) + 1;
    return { total, ...by };
  }, [users]);

  const handleRoleChange = useCallback(
    async (target: AdminUser, nextRole: AssignableRole) => {
      if (target.role === nextRole) return;
      if (!user) return;
      setPendingUserId(target.id);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/admin/users/role", {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ userId: target.id, role: nextRole }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          message?: string;
        };
        if (!res.ok || !json.ok) {
          throw new Error(json.message ?? "Could not change role.");
        }
        toast.success(
          `${target.displayName || target.email || "User"} → ${ROLE_LABEL[nextRole]}`
        );
        // Optimistically update; refetch in the background for consistency.
        setUsers((prev) =>
          prev.map((u) => (u.id === target.id ? { ...u, role: nextRole } : u))
        );
        void fetchUsers();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not change role.");
      } finally {
        setPendingUserId(null);
      }
    },
    [user, fetchUsers]
  );

  if (loading || !user) {
    return <PageSkeleton />;
  }

  if (error && users.length === 0) {
    return (
      <AccessBlocked
        title={
          error.includes("Super admin")
            ? "Super admin access required"
            : "Couldn't load users"
        }
        message={error}
        onRetry={() => void fetchUsers()}
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-orange-500">
            <UserCog className="h-6 w-6" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Super admin
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Users</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Promote, demote, or audit who has access. Role changes take effect
            on the user's next page load.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-border"
          onClick={() => void fetchUsers()}
          disabled={fetching}
        >
          {fetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </header>

      {/* Stat cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total"
          value={counts.total}
          tone="muted"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label="Super admins"
          value={counts.super_admin}
          tone="orange"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Admins"
          value={counts.admin}
          tone="emerald"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <StatCard
          label="Supervisors"
          value={counts.supervisor}
          tone="sky"
          icon={<ShieldOff className="h-4 w-4" />}
        />
      </section>

      {/* Filters */}
      <section className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, email, or user id"
              className="border-border bg-background pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5 sm:flex-nowrap">
            {ROLE_FILTERS.map((f) => {
              const active = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                    active
                      ? "border-orange-500 bg-orange-500/15 text-orange-200"
                      : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* List */}
      {fetching && users.length === 0 ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            {users.length === 0
              ? "No users yet."
              : "No users match those filters."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              pending={pendingUserId === u.id}
              onChangeRole={handleRoleChange}
            />
          ))}
        </ul>
      )}

      <p className="text-center text-[11px] text-muted-foreground">
        {filtered.length} of {users.length} {users.length === 1 ? "user" : "users"}
      </p>
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "muted" | "orange" | "emerald" | "sky";
  icon: React.ReactNode;
}) {
  const toneClass =
    tone === "orange"
      ? "bg-orange-500/10 text-orange-300 border-orange-500/30"
      : tone === "emerald"
        ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
        : tone === "sky"
          ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
          : "bg-muted text-muted-foreground border-border";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm",
        toneClass
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background/40">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest opacity-80">
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums leading-tight">
          {value}
        </p>
      </div>
    </div>
  );
}

function UserRow({
  user,
  pending,
  onChangeRole,
}: {
  user: AdminUser;
  pending: boolean;
  onChangeRole: (user: AdminUser, role: AssignableRole) => void;
}) {
  const display = user.displayName || user.email || "Unnamed";
  const initials = initialsOf(user.displayName, user.email);
  const badge = roleBadgeClass(user.role);

  return (
    <li
      className={cn(
        "group rounded-2xl border border-border bg-card p-3 shadow-sm transition-all hover:border-orange-500/30 sm:p-4",
        pending && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        {/* Avatar + identity */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full ring-2 ring-border">
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt=""
                fill
                sizes="48px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-500/80 to-amber-600/80 text-sm font-bold text-white">
                {initials}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-sm font-semibold leading-tight text-foreground sm:text-base">
                {display}
              </p>
              {user.isSelf ? (
                <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  You
                </span>
              ) : null}
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  badge
                )}
              >
                {ROLE_LABEL[user.role]}
              </span>
            </div>
            {user.email && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {user.email}
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground/70">
              Joined {timeAgo(user.createdAt)} · <span className="font-mono">{user.id.slice(0, 8)}…</span>
            </p>
          </div>
        </div>

        {/* Role picker */}
        <div className="flex items-center gap-2 sm:shrink-0">
          <Label
            htmlFor={`role-${user.id}`}
            className="hidden text-xs text-muted-foreground sm:inline"
          >
            Role
          </Label>
          <Select
            value={user.role}
            onValueChange={(v) =>
              onChangeRole(user, v as AssignableRole)
            }
            disabled={pending}
          >
            <SelectTrigger
              id={`role-${user.id}`}
              className="h-9 w-[160px] border-border bg-background"
            >
              <SelectValue />
              {pending ? (
                <Loader2 className="ml-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ChevronDown className="ml-2 h-3.5 w-3.5 opacity-60" />
              )}
            </SelectTrigger>
            <SelectContent>
              {ASSIGNABLE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {ROLE_LABEL[r]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {ROLE_DESCRIPTION[r]}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </li>
  );
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-12">
      <Skeleton className="h-10 w-48 bg-muted" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl bg-muted" />
        ))}
      </div>
      <Skeleton className="h-16 rounded-2xl bg-muted" />
      <ListSkeleton />
    </div>
  );
}

function ListSkeleton() {
  return (
    <ul className="space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <li key={i}>
          <Skeleton className="h-20 w-full rounded-2xl bg-muted" />
        </li>
      ))}
    </ul>
  );
}

function AccessBlocked({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
        <Lock className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      <p className="mt-4 text-xs text-muted-foreground/80">
        Add your email to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
          SUPER_ADMIN_EMAILS
        </code>{" "}
        (comma-separated) in Vercel project settings to bootstrap the first
        super admin, then refresh.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="border-border"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Try again
        </Button>
        <Button asChild className="bg-orange-600 text-white hover:bg-orange-500">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    </div>
  );
}
