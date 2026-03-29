"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, Plus, ShoppingBag, User } from "lucide-react";
import { useCartDrawerStore } from "@/store/cartDrawerStore";
import { useCartStore } from "@/store/cartStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAddProductStore } from "@/store/adminAddProductStore";
import { cn } from "@/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { user, isAdmin } = useAuth();
  const cartCount = useCartStore((s) => s.getCount());
  const wishlistCount = useWishlistStore((s) => s.ids.length);
  const setCartOpen = useCartDrawerStore((s) => s.setOpen);
  const openAddProduct = useAdminAddProductStore((s) => s.openDialog);

  const accountHref = user
    ? "/account"
    : `/auth/sign-in?next=${encodeURIComponent("/account")}`;
  const accountActive =
    pathname.startsWith("/account") ||
    pathname.startsWith("/auth/sign-in") ||
    pathname.startsWith("/auth/sign-up");

  const navItem = (
    href: string,
    label: string,
    Icon: typeof Home,
    active: boolean
  ) => (
    <li className="flex-1">
      <Link
        href={href}
        className={cn(
          "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
          active
            ? "text-orange-500"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    </li>
  );

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Mobile primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around gap-1 px-2 pt-1">
        {navItem("/", "Home", Home, pathname === "/")}
        {navItem(
          "/explore",
          "Explore",
          LayoutGrid,
          pathname.startsWith("/explore")
        )}
        {isAdmin ? (
          <li className="flex-1">
            <button
              type="button"
              onClick={() => openAddProduct()}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              )}
              aria-label="Add product"
            >
              <Plus className="h-5 w-5" />
              Add
            </button>
          </li>
        ) : (
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={cn(
                "relative flex w-full flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              )}
            >
              <span className="relative inline-flex">
                <ShoppingBag className="h-5 w-5" />
                {cartCount > 0 ? (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-0.5 text-[9px] font-bold text-white">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                ) : null}
              </span>
              Cart
            </button>
          </li>
        )}
        <li className="flex-1">
          <Link
            href="/wishlist"
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              pathname.startsWith("/wishlist")
                ? "text-orange-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span className="relative inline-flex">
              <Heart
                className={cn(
                  "h-5 w-5",
                  wishlistCount > 0 && "fill-orange-500/25 text-orange-500"
                )}
              />
              {wishlistCount > 0 ? (
                <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-0.5 text-[9px] font-bold text-white">
                  {wishlistCount > 99 ? "99+" : wishlistCount}
                </span>
              ) : null}
            </span>
            Wishlist
          </Link>
        </li>
        <li className="flex-1">
          <Link
            href={accountHref}
            className={cn(
              "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              accountActive
                ? "text-orange-500"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="h-5 w-5" />
            Account
          </Link>
        </li>
      </ul>
    </nav>
  );
}
