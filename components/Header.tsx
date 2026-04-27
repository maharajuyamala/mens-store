"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  ChevronRight,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Package,
  PlusCircle,
  ShoppingCart,
  Sparkles,
  Store,
  User,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AddItemDialog, AddProductOpenButton } from "@/components/AddDialogue";
import { ProductBarcodeDialog } from "@/components/admin/ProductBarcodeDialog";
import { CartDrawer } from "@/components/Cart/CartDrawer";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useCartDrawerStore } from "@/store/cartDrawerStore";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

export function Header() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const setCartOpen = useCartDrawerStore((s) => s.setOpen);
  const cartCount = useCartStore((s) => s.getCount());

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const shouldLock = isMenuOpen;
    document.body.style.overflow = shouldLock ? "hidden" : "auto";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [isMenuOpen]);

  const navLinks = [
    { label: "Home", link: "/" },
    { label: "Shop", link: "/explore" },
    { label: "Collections", link: "/" },
    { label: "Contact", link: "/" },
  ];

  const menuVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0, transition: { staggerChildren: 0.1 } },
  };
  const linkVariants = {
    hidden: { opacity: 0, y: -10 },
    visible: { opacity: 1, y: 0 },
  };

  const pathname = usePathname();

  const mobileListVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.055, delayChildren: 0.08 },
    },
  };
  const mobileRowVariants = {
    hidden: { opacity: 0, x: 18 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const },
    },
  };

  const mainNavWithIcons: {
    label: string;
    href: string;
    icon: LucideIcon;
    hint?: string;
  }[] = [
    { label: "Home", href: "/", icon: Home, hint: "Editorial & drops" },
    { label: "Shop", href: "/explore", icon: Store, hint: "Browse the catalog" },
    { label: "Collections", href: "/", icon: Sparkles, hint: "Curated edits" },
    { label: "Contact", href: "/", icon: Mail, hint: "We reply within a day" },
  ];

  const isItemActive = (href: string, label: string) => {
    if (href === "/") return label === "Home" && pathname === "/";
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <>
      <motion.header
        initial={false}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed top-0 left-0 z-50 flex w-[100svw] items-center justify-between overflow-x-hidden border-b border-border bg-background/85 px-4 py-4 text-foreground shadow-none backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 sm:px-8",
          isScrolled && "shadow-sm shadow-black/20"
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 text-xl font-bold tracking-wider text-foreground"
        >
          <img src="/favicon.ico" alt="logo" className="w-8 h-8" />
          Second Skin
        </Link>

        <motion.nav
          variants={menuVariants}
          initial="hidden"
          animate="visible"
          className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex"
        >
          {navLinks.map((item) => (
            <motion.span key={item.label} variants={linkVariants}>
              <Link
                href={item.link}
                className="group relative hover:text-foreground"
              >
                {item.label}
                <span className="absolute bottom-0 left-0 h-0.5 w-0 bg-orange-500 transition-all duration-300 group-hover:w-full" />
              </Link>
            </motion.span>
          ))}
        </motion.nav>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3 md:gap-4">
          {isAdmin ? (
            <>
              <AddProductOpenButton variant="icon-only" className="md:hidden" />
              <AddProductOpenButton />
              <Link
                href="/admin"
                className="hidden items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-400 transition-colors hover:bg-orange-500/20 md:inline-flex"
              >
                <LayoutDashboard className="size-4 shrink-0" />
                Admin
              </Link>
              <Link
                href="/admin/products"
                className="hidden rounded-full border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:border-orange-500 lg:inline-flex"
              >
                Products
              </Link>
            </>
          ) : null}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setCartOpen(true)}
            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-transparent text-foreground transition-colors duration-300 hover:border-orange-500"
            aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
          >
            <ShoppingCart className="h-5 w-5 shrink-0" aria-hidden />
            <AnimatePresence mode="wait">
              {cartCount > 0 ? (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 22 }}
                  className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold leading-none text-white shadow-md"
                >
                  {cartCount > 99 ? "99+" : cartCount}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </motion.button>

          {loading ? (
            <div className="hidden items-center gap-2 md:flex">
              <Skeleton className="h-9 w-28 rounded-full bg-muted" />
            </div>
          ) : user ? (
            <Link
              href="/account"
              className="hidden max-w-[140px] truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline lg:max-w-[180px] md:block"
              title={user.email ?? undefined}
            >
              {user.email}
            </Link>
          ) : null}

          {loading ? (
            <Skeleton className="hidden h-9 w-24 rounded-full bg-muted md:block" />
          ) : !user ? (
            <Link href="/auth/sign-in" className="hidden md:inline-flex">
              <motion.span
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-orange-500"
              >
                Sign in <ArrowRight className="h-4 w-4" />
              </motion.span>
            </Link>
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => void signOut()}
              className="hidden items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground hover:border-orange-500 md:inline-flex"
            >
              Logout
            </motion.button>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsMenuOpen(true)}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-foreground transition-colors hover:border-orange-500 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5 shrink-0" aria-hidden />
          </motion.button>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMenuOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-50 bg-gradient-to-br from-black/85 via-zinc-950/90 to-black/80 backdrop-blur-md md:hidden"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden
          >
            <motion.aside
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.85 }}
              className="absolute top-0 right-0 flex h-[100dvh] w-[min(88vw,400px)] flex-col overflow-hidden border-l border-white/10 bg-zinc-950 shadow-[0_0_80px_-12px_rgba(0,0,0,0.85)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
              <div className="pointer-events-none absolute inset-x-8 top-24 h-40 rounded-full bg-orange-500/10 blur-3xl" />

              <div className="relative shrink-0 border-b border-white/[0.08] bg-gradient-to-b from-zinc-900/95 to-zinc-950 px-5 pb-5 pt-[max(1rem,env(safe-area-inset-top))]">
                <div className="flex items-start justify-between gap-3 pt-4">
                  <div className="min-w-0 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-400/95">
                      Second Skin
                    </p>
                    <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
                      Menu
                    </h2>
                    {user?.email ? (
                      <p className="mt-2 truncate text-xs text-zinc-500">{user.email}</p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-500">Signed out · browse freely</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen(false)}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-zinc-300 transition-colors hover:border-orange-500/35 hover:bg-white/[0.1] hover:text-white"
                    aria-label="Close menu"
                  >
                    <X className="h-5 w-5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              <nav className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-5">
                <p className="mb-2.5 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Browse
                </p>
                <motion.ul
                  className="space-y-1.5"
                  variants={mobileListVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {mainNavWithIcons.map((item) => {
                    const active = isItemActive(item.href, item.label);
                    const Icon = item.icon;
                    return (
                      <motion.li key={item.href + item.label} variants={mobileRowVariants}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className={cn(
                            "group flex items-center gap-3.5 rounded-xl border px-2.5 py-3 transition-all duration-200",
                            active
                              ? "border-orange-500/35 bg-orange-500/[0.12] text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]"
                              : "border-transparent bg-white/[0.03] text-zinc-200 hover:border-white/10 hover:bg-white/[0.06]"
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200",
                              active
                                ? "border-orange-500/40 bg-orange-500/20 text-orange-200"
                                : "border-white/10 bg-zinc-900 text-zinc-400 group-hover:border-orange-500/30 group-hover:text-orange-200/90"
                            )}
                          >
                            <Icon className="size-[1.15rem]" strokeWidth={1.65} aria-hidden />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold leading-tight tracking-tight">
                              {item.label}
                            </span>
                            {item.hint ? (
                              <span className="mt-0.5 block text-xs leading-snug text-zinc-500 group-hover:text-zinc-400">
                                {item.hint}
                              </span>
                            ) : null}
                          </span>
                          <ChevronRight
                            className={cn(
                              "size-4 shrink-0 transition-transform duration-200",
                              active
                                ? "text-orange-400/80"
                                : "text-zinc-600 group-hover:translate-x-0.5 group-hover:text-zinc-400"
                            )}
                            aria-hidden
                          />
                        </Link>
                      </motion.li>
                    );
                  })}
                </motion.ul>

                {isAdmin ? (
                  <>
                    <p className="mb-2.5 mt-8 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      Admin
                    </p>
                    <motion.ul
                      className="space-y-1.5"
                      variants={mobileListVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {(
                        [
                          {
                            href: "/admin/add-product",
                            label: "Add product",
                            hint: "Create a listing",
                            icon: PlusCircle,
                          },
                          {
                            href: "/admin",
                            label: "Dashboard",
                            hint: "Overview & stats",
                            icon: LayoutDashboard,
                          },
                          {
                            href: "/admin/products",
                            label: "Products",
                            hint: "Inventory & pricing",
                            icon: Package,
                          },
                          {
                            href: "/admin/orders",
                            label: "Orders",
                            hint: "Fulfillment queue",
                            icon: ClipboardList,
                          },
                        ] as const
                      ).map((item) => {
                        const active = isItemActive(item.href, item.label);
                        const Icon = item.icon;
                        return (
                          <motion.li key={item.href} variants={mobileRowVariants}>
                            <Link
                              href={item.href}
                              onClick={() => setIsMenuOpen(false)}
                              className={cn(
                                "group flex items-center gap-3.5 rounded-xl border px-2.5 py-3 transition-all duration-200",
                                active
                                  ? "border-orange-500/35 bg-orange-500/[0.12] text-white"
                                  : "border-transparent bg-white/[0.03] text-zinc-200 hover:border-orange-500/20 hover:bg-orange-500/[0.07]"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-11 shrink-0 items-center justify-center rounded-xl border transition-colors duration-200",
                                  active
                                    ? "border-orange-500/40 bg-orange-500/20 text-orange-200"
                                    : "border-orange-500/15 bg-zinc-900 text-orange-300/70 group-hover:text-orange-200"
                                )}
                              >
                                <Icon className="size-[1.15rem]" strokeWidth={1.65} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[15px] font-semibold leading-tight tracking-tight">
                                  {item.label}
                                </span>
                                <span className="mt-0.5 block text-xs text-zinc-500 group-hover:text-zinc-400">
                                  {item.hint}
                                </span>
                              </span>
                              <ChevronRight
                                className="size-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400"
                                aria-hidden
                              />
                            </Link>
                          </motion.li>
                        );
                      })}
                    </motion.ul>
                  </>
                ) : null}

                <p className="mb-2.5 mt-8 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Bag
                </p>
                <motion.button
                  type="button"
                  variants={mobileRowVariants}
                  initial="hidden"
                  animate="visible"
                  onClick={() => {
                    setIsMenuOpen(false);
                    setCartOpen(true);
                  }}
                  className="group flex w-full items-center gap-3.5 rounded-xl border border-transparent bg-white/[0.03] px-2.5 py-3 text-left text-zinc-200 transition-all duration-200 hover:border-white/10 hover:bg-white/[0.06]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-400 transition-colors group-hover:border-orange-500/30 group-hover:text-orange-200/90">
                    <ShoppingCart className="size-[1.15rem]" strokeWidth={1.65} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight tracking-tight">
                      Your cart
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {cartCount > 0 ? `${cartCount} item${cartCount === 1 ? "" : "s"} ready` : "Tap to open drawer"}
                    </span>
                  </span>
                  {cartCount > 0 ? (
                    <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 px-2 text-xs font-bold text-white shadow-lg shadow-orange-500/25">
                      {cartCount > 99 ? "99+" : cartCount}
                    </span>
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5 group-hover:text-zinc-400"
                      aria-hidden
                    />
                  )}
                </motion.button>

                <div className="mt-auto border-t border-white/[0.08] pt-5 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  {!loading && !user ? (
                    <Link
                      href="/auth/sign-in"
                      onClick={() => setIsMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/25 transition-[filter,transform] hover:brightness-105 active:scale-[0.99]"
                    >
                      Sign in
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  ) : null}
                  {!loading && user ? (
                    <div className="space-y-2">
                      <Link
                        href="/account"
                        onClick={() => setIsMenuOpen(false)}
                        className="group flex items-center gap-3.5 rounded-xl border border-transparent bg-white/[0.03] px-2.5 py-3 text-zinc-200 transition-all hover:border-white/10 hover:bg-white/[0.06]"
                      >
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-900 text-zinc-400 group-hover:text-zinc-200">
                          <User className="size-[1.15rem]" strokeWidth={1.65} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[15px] font-semibold tracking-tight">Account</span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">Orders & profile</span>
                        </span>
                        <ChevronRight className="size-4 shrink-0 text-zinc-600 group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          void signOut();
                          setIsMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-xl border border-red-500/15 bg-red-500/[0.06] px-3 py-3 text-sm font-medium text-red-200/90 transition-colors hover:border-red-500/30 hover:bg-red-500/10"
                      >
                        <LogOut className="size-4 shrink-0 opacity-90" aria-hidden />
                        Sign out
                      </button>
                    </div>
                  ) : null}
                </div>
              </nav>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {isAdmin ? (
        <>
          <AddItemDialog />
          <ProductBarcodeDialog />
        </>
      ) : null}
      <CartDrawer />
    </>
  );
}
