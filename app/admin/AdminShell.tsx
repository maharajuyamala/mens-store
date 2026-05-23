"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Home,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  ScanBarcode,
  Sparkles,
  ShoppingBag,
  Users as UsersIcon,
  X,
} from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { ScrollToTop } from "@/components/ScrollToTop";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, isAssignableRole } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** When true, only super_admin sees it (filtered at render time). */
  superAdminOnly?: boolean;
};

type NavGroup = {
  label: string;
  items: readonly NavItem[];
};

/**
 * Sidebar nav is grouped so the sections read like a workflow ("Catalog" →
 * "Operations" → "Team"). The first item per group keeps a subtle divider
 * above it; the Team group is rendered only when the caller is super_admin.
 */
const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Workspace",
    items: [{ href: "/admin", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products", label: "Products", icon: Package },
      { href: "/admin/add-product", label: "Add Product", icon: PlusCircle },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/inventory/scan", label: "Scan & stock", icon: ScanBarcode },
      { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
      { href: "/admin/media", label: "Media", icon: ImageIcon },
    ],
  },
  {
    label: "Team",
    items: [
      {
        href: "/admin/users",
        label: "Users",
        icon: UsersIcon,
        superAdminOnly: true,
      },
    ],
  },
];

function roleBadgeStyle(role: string | null | undefined): string {
  if (role === "super_admin")
    return "bg-orange-500/15 text-orange-300 border-orange-500/30";
  if (role === "admin")
    return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
  if (role === "supervisor")
    return "bg-sky-500/15 text-sky-300 border-sky-500/30";
  return "bg-muted text-muted-foreground border-border";
}

function roleDisplay(role: string | null | undefined): string {
  if (isAssignableRole(role ?? "")) {
    return ROLE_LABEL[role as keyof typeof ROLE_LABEL];
  }
  return "Member";
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut, isSuperAdmin } = useAuth();

  // Filter groups + items by visibility, then drop any group that ends up empty.
  const visibleGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => !item.superAdminOnly || isSuperAdmin),
  })).filter((g) => g.items.length > 0);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const displayName =
    profile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split("@")[0] ||
    "Admin";
  const avatarSrc = user?.photoURL || profile?.photoURL || null;
  const initials = displayName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = roleDisplay(profile?.role);
  const roleClass = roleBadgeStyle(profile?.role);

  return (
    <AdminGuard>
      <ScrollToTop />
      <div className="min-h-screen bg-background text-foreground">
        {/* ────────────── Top bar (mobile + desktop) ────────────── */}
        <header
          className={cn(
            "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/80",
            "bg-card/85 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/70 sm:px-5"
          )}
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-foreground lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Link
            href="/admin"
            className="flex min-w-0 items-center gap-2 text-foreground"
          >
            <span
              aria-hidden
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-[10px] font-black uppercase text-white shadow-md shadow-orange-500/30"
            >
              SS
            </span>
            <span className="min-w-0 truncate text-sm font-bold tracking-tight">
              SecondSkin
              <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                Admin
              </span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="text-foreground hover:bg-orange-500/10 hover:text-orange-400"
              aria-label="Back to store home"
              title="Back to store home"
            >
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </header>

        {/* ────────────── Mobile overlay backdrop ────────────── */}
        <AnimatePresence>
          {mobileOpen ? (
            <motion.button
              type="button"
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        {/* ────────────── Layout (sidebar + main) ────────────── */}
        <div className="flex">
          <aside
            className={cn(
              "fixed left-0 top-0 z-50 flex h-svh w-[280px] flex-col",
              "border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl",
              "lg:sticky lg:top-14 lg:z-0 lg:h-[calc(100svh-3.5rem)] lg:translate-x-0 lg:shadow-none",
              "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
            aria-label="Admin navigation"
          >
            <motion.div
              className="flex h-full min-h-0 flex-col"
              initial={{ opacity: 0, x: -28 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 320,
                damping: 30,
                mass: 0.85,
              }}
            >
              {/* Branded sidebar header */}
              <div className="flex items-center justify-between gap-3 border-b border-sidebar-border/70 px-4 py-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden
                    className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-[11px] font-black uppercase text-white shadow-lg shadow-orange-500/30"
                  >
                    SS
                    <span className="absolute -bottom-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-sidebar">
                      <Sparkles className="h-2 w-2 text-white" />
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold tracking-tight">
                      SecondSkin
                    </p>
                    <p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/55">
                      Admin console
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-sidebar-foreground lg:hidden"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Grouped nav */}
              <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
                {visibleGroups.map((group, gi) => (
                  <div key={group.label}>
                    <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-sidebar-foreground/50">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map((item, ii) => {
                        const active =
                          item.href === "/admin"
                            ? pathname === "/admin"
                            : pathname.startsWith(item.href);
                        const Icon = item.icon;
                        return (
                          <motion.li
                            key={item.href}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{
                              delay: 0.04 * (gi * 3 + ii),
                              duration: 0.32,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                          >
                            <Link
                              href={item.href}
                              onClick={() => setMobileOpen(false)}
                              className={cn(
                                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                                active
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                              )}
                            >
                              {/* Active accent bar */}
                              <span
                                aria-hidden
                                className={cn(
                                  "absolute inset-y-1.5 left-0 w-[3px] rounded-full transition-all",
                                  active
                                    ? "bg-gradient-to-b from-orange-500 to-amber-400"
                                    : "bg-transparent group-hover:bg-sidebar-accent-foreground/20"
                                )}
                              />
                              <span
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                                  active
                                    ? "bg-orange-500/15 text-orange-400"
                                    : "bg-sidebar-accent/30 text-sidebar-foreground/70 group-hover:bg-sidebar-accent/60 group-hover:text-sidebar-accent-foreground"
                                )}
                              >
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1 truncate">
                                {item.label}
                              </span>
                              <ChevronRight
                                className={cn(
                                  "h-3.5 w-3.5 shrink-0 transition-all",
                                  active
                                    ? "text-orange-400 opacity-100"
                                    : "text-sidebar-foreground/40 opacity-0 group-hover:opacity-100"
                                )}
                              />
                            </Link>
                          </motion.li>
                        );
                      })}
                    </ul>
                  </div>
                ))}

                {/* Footer shortcut: Back to store */}
                <div className="border-t border-sidebar-border/70 pt-3">
                  <Link
                    href="/"
                    onClick={() => setMobileOpen(false)}
                    className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent/30 text-sidebar-foreground/70 transition-colors group-hover:bg-sidebar-accent/60 group-hover:text-sidebar-accent-foreground">
                      <Home className="h-4 w-4" />
                    </span>
                    Back to store
                  </Link>
                </div>
              </nav>

              {/* User profile card */}
              <div className="border-t border-sidebar-border/70 p-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: 0.22,
                    duration: 0.35,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="space-y-2.5 rounded-2xl border border-sidebar-border/60 bg-sidebar-accent/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative shrink-0">
                      {avatarSrc ? (
                        <Image
                          src={avatarSrc}
                          alt=""
                          width={42}
                          height={42}
                          className="h-[42px] w-[42px] rounded-full object-cover ring-2 ring-sidebar-border"
                          unoptimized={avatarSrc.startsWith("data:")}
                        />
                      ) : (
                        <div
                          className="flex h-[42px] w-[42px] items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600 text-xs font-bold text-white ring-2 ring-sidebar-border"
                          aria-hidden
                        >
                          {initials}
                        </div>
                      )}
                      <span
                        aria-hidden
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-sidebar"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-sidebar-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-[11px] text-sidebar-foreground/60">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        roleClass
                      )}
                    >
                      {roleLabel}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      onClick={() => void signOut()}
                    >
                      <LogOut className="mr-1 h-3.5 w-3.5" />
                      Sign out
                    </Button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:pr-8">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
