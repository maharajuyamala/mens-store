"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Search,
  ShoppingCart,
  Menu,
  X,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { AddItemDialog, AddProductOpenButton } from "@/components/AddDialogue";
import { ProductBarcodeDialog } from "@/components/admin/ProductBarcodeDialog";
import { CartDrawer } from "@/components/Cart/CartDrawer";
import { useAdminAddProductStore } from "@/store/adminAddProductStore";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchDialog } from "@/components/search/SearchDialogContext";
import { useCartDrawerStore } from "@/store/cartDrawerStore";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

export function Header() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const setCartOpen = useCartDrawerStore((s) => s.setOpen);
  const { openSearch } = useSearchDialog();
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

  return (
    <>
      <motion.header
        initial={false}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed top-0 left-0 z-50 flex w-[100svw] items-center justify-between overflow-x-hidden border-b border-border px-4 py-4 text-foreground sm:px-8",
          "!bg-white !shadow-none dark:!bg-background",
          isScrolled && "shadow-sm"
        )}
      >
        <Link
          href="/"
          className="flex min-w-0 shrink items-center gap-2 text-2xl font-bold tracking-wider text-foreground"
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            className="text-orange-500"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L2 7V17L12 22L22 17V7L12 2Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M2 7L12 12L22 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 12V22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          SecondSkin
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
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openSearch()}
            className="hidden rounded-full border border-border p-2.5 text-foreground transition-colors hover:border-orange-500 md:inline-flex"
            aria-label="Search (⌘K)"
          >
            <Search className="h-5 w-5" />
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => openSearch()}
            className="inline-flex rounded-full border border-border p-2.5 text-foreground transition-colors hover:border-orange-500 md:hidden"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </motion.button>
          {isAdmin ? (
            <>
              <AddProductOpenButton variant="icon-only" className="md:hidden" />
              <AddProductOpenButton />
              <Link
                href="/admin"
                className="hidden items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-500/20 md:inline-flex dark:text-orange-400"
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
          ) : (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setCartOpen(true)}
              className="relative rounded-full border border-border bg-transparent p-2.5 text-foreground transition-colors duration-300 hover:border-orange-500"
              aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ""}`}
            >
              <ShoppingCart className="h-5 w-5" />
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
          )}

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

          <div className="md:hidden">
            <motion.button
              type="button"
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsMenuOpen(true)}
              className="text-foreground"
            >
              <Menu className="h-7 w-7" />
            </motion.button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm z-50 md:hidden"
            onClick={() => setIsMenuOpen(false)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 h-full w-[80vw] max-w-sm bg-gray-900 p-8 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="absolute top-6 right-6 text-gray-400 hover:text-white"
              >
                <X className="h-7 w-7" />
              </button>
              <nav className="flex flex-col gap-8 mt-16 text-lg">
                <button
                  type="button"
                  className="text-left text-gray-200 hover:text-orange-500 transition-colors"
                  onClick={() => {
                    setIsMenuOpen(false);
                    openSearch();
                  }}
                >
                  Search
                </button>
                {navLinks.map((item) => (
                  <a
                    key={item.label}
                    href={item.link}
                    className="text-gray-200 hover:text-orange-500 transition-colors"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ))}
                {isAdmin ? (
                  <>
                    <button
                      type="button"
                      className="text-left text-gray-200 transition-colors hover:text-orange-500"
                      onClick={() => {
                        setIsMenuOpen(false);
                        useAdminAddProductStore.getState().openDialog();
                      }}
                    >
                      Add product
                    </button>
                    <Link
                      href="/admin"
                      className="text-left text-gray-200 transition-colors hover:text-orange-500"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Admin dashboard
                    </Link>
                    <Link
                      href="/admin/products"
                      className="text-left text-gray-200 transition-colors hover:text-orange-500"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Products
                    </Link>
                    <Link
                      href="/admin/orders"
                      className="text-left text-gray-200 transition-colors hover:text-orange-500"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Orders
                    </Link>
                  </>
                ) : (
                  <button
                    type="button"
                    className="text-left text-gray-200 transition-colors hover:text-orange-500"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setCartOpen(true);
                    }}
                  >
                    Cart{cartCount > 0 ? ` (${cartCount})` : ""}
                  </button>
                )}
                {!loading && !user ? (
                  <Link
                    href="/auth/sign-in"
                    className="mt-4 text-left text-gray-200 hover:text-orange-500"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Sign in
                  </Link>
                ) : null}
                {!loading && user ? (
                  <>
                    <Link
                      href="/account"
                      className="text-left text-gray-200 transition-colors hover:text-orange-500"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      Account
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        void signOut();
                        setIsMenuOpen(false);
                      }}
                      className="mt-2 text-left text-gray-200 transition-colors hover:text-orange-500"
                    >
                      Logout
                    </button>
                  </>
                ) : null}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdmin ? (
        <>
          <AddItemDialog />
          <ProductBarcodeDialog />
        </>
      ) : null}
      {!isAdmin ? <CartDrawer /> : null}
    </>
  );
}
