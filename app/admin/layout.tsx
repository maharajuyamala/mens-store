"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Home,
  ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PlusCircle,
  ScanBarcode,
  ShoppingBag,
  X,
} from "lucide-react";
import { AdminGuard } from "@/components/AdminGuard";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/add-product", label: "Add Product", icon: PlusCircle },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/inventory/scan", label: "Scan & stock", icon: ScanBarcode },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/media", label: "Media", icon: ImageIcon },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, profile, signOut } = useAuth();

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

  return (
    <AdminGuard>
      <div className="dark min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-30 flex h-11 items-center border-b border-border bg-card px-3 lg:hidden">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open admin menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="ml-2 text-sm font-semibold tracking-tight">
            Admin panel
          </span>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.button
              type="button"
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
            />
          ) : null}
        </AnimatePresence>

        <div className="flex min-h-[calc(100svh-7rem)]">
          <aside
            className={cn(
              "fixed left-0 top-0 z-50 flex h-[calc(100svh-6rem)] w-[260px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-2xl lg:sticky lg:top-28 lg:z-0 lg:h-[calc(100svh-7rem)] lg:translate-x-0 lg:shadow-none",
              "transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
            )}
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
              <div className="flex items-center justify-between border-b border-sidebar-border px-3 py-3 lg:hidden">
                <span className="text-sm font-semibold">Menu</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-sidebar-foreground"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
                {NAV.map((item, i) => {
                  const active =
                    item.href === "/admin"
                      ? pathname === "/admin"
                      : pathname.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.05 * i,
                        duration: 0.32,
                        ease: [0.22, 1, 0.36, 1],
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        {item.label}
                      </Link>
                    </motion.div>
                  );
                })}

                {/* Home link */}
                <div className="mt-auto border-t border-sidebar-border pt-2">
                  <Link
                    href="/"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  >
                    <Home className="h-4 w-4 shrink-0 opacity-90" />
                    Back to store
                  </Link>
                </div>
              </nav>

              <div className="mt-auto border-t border-sidebar-border p-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-3"
                >
                  <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/40 px-2 py-2">
                    {avatarSrc ? (
                      <Image
                        src={avatarSrc}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-sidebar-border"
                        unoptimized={avatarSrc.startsWith("data:")}
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground ring-2 ring-sidebar-border"
                        aria-hidden
                      >
                        {initials}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {displayName}
                      </p>
                      <p className="truncate text-xs text-sidebar-foreground/60">
                        {user?.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    onClick={() => void signOut()}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </Button>
                </motion.div>
              </div>
            </motion.div>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:pl-2 lg:pr-8">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
