"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import type { ExploreProduct } from "@/lib/explore/types";
import { cn, inr } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlistStore";

type Props = {
  product: ExploreProduct;
  onQuickAdd?: (product: ExploreProduct) => void;
  imagePriority?: boolean;
};

export function ExploreProductCard({
  product,
  onQuickAdd,
  imagePriority = false,
}: Props) {
  const [addedFlash, setAddedFlash] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.ids.includes(product.doc_id));

  const images = product.images.length > 0 ? product.images : product.image ? [product.image] : [];
  const hasMultiple = images.length > 1;

  // Auto-cycle on hover (desktop)
  useEffect(() => {
    if (!hasMultiple) return;
    if (isHovered) {
      intervalRef.current = setInterval(() => {
        setActiveIndex((i) => (i + 1) % images.length);
      }, 900);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Smoothly reset back to first image after leaving
      const t = setTimeout(() => setActiveIndex(0), 400);
      return () => clearTimeout(t);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isHovered, hasMultiple, images.length]);

  const onQuick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onQuickAdd) return;
      onQuickAdd(product);
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 1400);
    },
    [onQuickAdd, product]
  );

  // Touch swipe handlers for mobile
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    if (Math.abs(dx) > 30 && hasMultiple) {
      if (dx < 0) {
        setActiveIndex((i) => (i + 1) % images.length);
      } else {
        setActiveIndex((i) => (i - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
  };

  const isSale =
    typeof product.compareAtPrice === "number" &&
    product.compareAtPrice > product.price;
  const isLow = product.stockStatus === "low_stock";
  const isOut = product.stockStatus === "out_of_stock";

  const href = `/product-details?id=${product.doc_id}`;

  return (
    <div
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-[#111111] shadow-md ring-1 ring-white/5 transition-all duration-300 hover:shadow-2xl hover:shadow-black/60 hover:ring-white/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image area */}
      <Link href={href} className="block flex-shrink-0">
        <div
          className="relative aspect-[3/4] w-full overflow-hidden bg-gray-900"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {/* Images — crossfade between them */}
          {images.length > 0 ? (
            <>
              {images.map((src, i) => (
                <div
                  key={src}
                  className={cn(
                    "absolute inset-0 transition-opacity duration-500",
                    i === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0"
                  )}
                >
                  <Image
                    src={src}
                    alt={i === 0 ? product.name : `${product.name} – view ${i + 1}`}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-500 will-change-transform",
                      isHovered && i === activeIndex && "scale-[1.06]"
                    )}
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    priority={imagePriority && i === 0}
                  />
                </div>
              ))}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-gray-600">
              No image
            </div>
          )}

          {/* Gradient overlay */}
          <div className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-60 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Badges */}
          <div className="pointer-events-none absolute left-2 top-2 z-30 flex flex-col gap-1">
            {isSale && (
              <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                Sale
              </span>
            )}
            {isLow && !isOut && (
              <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black shadow-sm">
                Low stock
              </span>
            )}
            {isOut && (
              <span className="rounded-full bg-gray-700/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-300 shadow-sm">
                Sold out
              </span>
            )}
          </div>

          {/* Image count badge (top right, shown when multiple) */}
          {hasMultiple && (
            <div className="absolute right-2 top-2 z-30 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-sm">
              <span>{activeIndex + 1}/{images.length}</span>
            </div>
          )}

          {/* Wishlist button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleWishlist(product.doc_id);
            }}
            aria-label={inWishlist ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={inWishlist}
            className={cn(
              "absolute right-2 top-2 z-30 flex h-8 w-8 items-center justify-center rounded-full border backdrop-blur-md transition-all duration-200",
              hasMultiple ? "top-9" : "top-2",
              inWishlist
                ? "border-orange-500/60 bg-orange-500/20 text-orange-400"
                : "border-white/20 bg-black/40 text-white/70 hover:border-orange-400/50 hover:text-orange-400"
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4 transition-transform duration-200 active:scale-90",
                inWishlist && "fill-orange-500 text-orange-500"
              )}
            />
          </button>

          {/* Dot indicators — shown on hover (desktop) or always on mobile if multiple */}
          {hasMultiple && (
            <div
              className={cn(
                "absolute bottom-14 inset-x-0 z-30 flex justify-center gap-1.5 transition-opacity duration-300",
                "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              )}
            >
              {images.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveIndex(i);
                    // Reset auto-cycle timer
                    if (intervalRef.current) clearInterval(intervalRef.current);
                    if (isHovered) {
                      intervalRef.current = setInterval(
                        () => setActiveIndex((idx) => (idx + 1) % images.length),
                        900
                      );
                    }
                  }}
                  aria-label={`View image ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    i === activeIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/40 hover:bg-white/70"
                  )}
                />
              ))}
            </div>
          )}

          {/* Quick-add — slides up from bottom on hover */}
          {onQuickAdd && (
            <div className="absolute inset-x-0 bottom-0 z-30 translate-y-full p-2.5 transition-transform duration-300 ease-out group-hover:translate-y-0">
              <button
                type="button"
                onClick={onQuick}
                disabled={isOut}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold shadow-lg transition-all duration-200 active:scale-[0.97]",
                  addedFlash
                    ? "bg-emerald-500 text-white"
                    : isOut
                      ? "cursor-not-allowed bg-gray-700 text-gray-400"
                      : "bg-orange-500 text-white hover:bg-orange-400"
                )}
              >
                <ShoppingBag className="h-4 w-4 shrink-0" />
                {addedFlash ? "Added to bag ✓" : isOut ? "Out of stock" : "Quick add"}
              </button>
            </div>
          )}
        </div>
      </Link>

      {/* Info */}
      <Link href={href} className="block flex-1 px-3 pb-3 pt-2.5">
        <h3 className="line-clamp-2 text-[13px] font-medium leading-snug text-white/90 sm:text-sm">
          {product.name}
        </h3>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-1.5">
          <span className="text-sm font-bold text-orange-400 sm:text-base">
            {inr.format(product.price)}
          </span>
          {isSale && typeof product.compareAtPrice === "number" && (
            <span className="text-xs text-gray-500 line-through">
              {inr.format(product.compareAtPrice)}
            </span>
          )}
        </div>
        {addedFlash && (
          <p className="mt-1 text-[11px] font-medium text-emerald-400">
            Added to bag
          </p>
        )}
      </Link>
    </div>
  );
}
