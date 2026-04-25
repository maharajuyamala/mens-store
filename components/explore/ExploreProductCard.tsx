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
  className?: string;
};

export function ExploreProductCard({
  product,
  onQuickAdd,
  imagePriority = false,
  className,
}: Props) {
  const [addedFlash, setAddedFlash] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef<number | null>(null);

  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.ids.includes(product.doc_id));

  const images =
    product.images.length > 0
      ? product.images
      : product.image
        ? [product.image]
        : [];
  const hasMultiple = images.length > 1;

  useEffect(() => {
    if (!hasMultiple) return;
    if (isHovered) {
      intervalRef.current = setInterval(() => {
        setActiveIndex((i) => (i + 1) % images.length);
      }, 900);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
  const isOut = product.stockStatus === "out_of_stock";

  const href = `/product-details?id=${product.doc_id}`;

  return (
    <article
      className={cn(
        "group/card relative isolate h-full min-h-0 overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950 shadow-[0_2px_20px_-4px_rgba(0,0,0,0.75)] ring-1 ring-black/40 transition-[transform,box-shadow,border-color] duration-300 sm:rounded-2xl",
        "hover:-translate-y-0.5 hover:border-orange-500/25 hover:shadow-[0_16px_40px_-12px_rgba(249,115,22,0.22)]",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="pointer-events-none relative aspect-[3/4] w-full bg-zinc-950">
        {/* Hit target + swipe — auto pointer-events above none parent */}
        <Link
          href={href}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          className="pointer-events-auto absolute inset-0 z-[2] rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <span className="sr-only">
            View {product.name}, {inr.format(product.price)}
          </span>
        </Link>
        {images.length > 0 ? (
          <>
            {images.map((src, i) => (
              <div
                key={src}
                className={cn(
                  "absolute inset-0 transition-opacity duration-500 ease-out",
                  i === activeIndex ? "z-0 opacity-100" : "z-0 opacity-0"
                )}
              >
                <Image
                  src={src}
                  alt={
                    i === 0
                      ? product.name
                      : `${product.name} – view ${i + 1}`
                  }
                  fill
                  className={cn(
                    "object-cover transition-transform duration-700 ease-out will-change-transform",
                    isHovered && i === activeIndex && "scale-[1.03]"
                  )}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  priority={imagePriority && i === 0}
                />
              </div>
            ))}
          </>
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center text-xs text-zinc-600">
            No image
          </div>
        )}

        {/* Readability wash */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black via-black/25 to-black/40 opacity-80 transition-opacity duration-300 group-hover/card:opacity-95"
          aria-hidden
        />

        {/* Added feedback — no extra footer space */}
        {addedFlash ? (
          <div className="pointer-events-none absolute left-1/2 top-12 z-[25] -translate-x-1/2 rounded-full border border-emerald-500/40 bg-emerald-600/95 px-3 py-1 text-[11px] font-semibold text-white shadow-lg backdrop-blur-sm">
            Added to bag
          </div>
        ) : null}

        <div className="pointer-events-none absolute left-2.5 top-2.5 z-[15] flex flex-col gap-1 sm:left-3 sm:top-3">
          {isSale && (
            <span className="w-fit rounded-md bg-gradient-to-r from-orange-500 to-amber-400 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-md">
              Sale
            </span>
          )}
          {isOut && (
            <span className="w-fit rounded-md border border-white/20 bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-300 backdrop-blur-sm">
              Sold out
            </span>
          )}
        </div>

        {hasMultiple && (
          <div className="pointer-events-none absolute right-2.5 top-2.5 z-[15] rounded-md border border-white/15 bg-black/55 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white/90 backdrop-blur-md sm:right-3 sm:top-3">
            {activeIndex + 1}/{images.length}
          </div>
        )}

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
            "pointer-events-auto absolute right-2.5 z-[20] flex size-8 items-center justify-center rounded-full border shadow-md transition-all duration-200 sm:size-9 sm:right-3",
            hasMultiple ? "top-9 sm:top-10" : "top-2.5 sm:top-3",
            inWishlist
              ? "border-orange-400/50 bg-orange-500/25 text-orange-300"
              : "border-white/20 bg-black/45 text-white/90 backdrop-blur-md hover:border-orange-400/50 hover:bg-black/60 hover:text-orange-300"
          )}
        >
          <Heart
            className={cn(
              "size-3.5 transition-transform active:scale-90 sm:size-4",
              inWishlist && "fill-orange-400 text-orange-300"
            )}
          />
        </button>

        {hasMultiple && (
          <div
            className={cn(
              "pointer-events-auto absolute bottom-[3.25rem] inset-x-0 z-[20] flex justify-center gap-1 sm:bottom-[3.5rem]",
              "opacity-100 sm:opacity-0 sm:group-hover/card:opacity-100"
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
                  if (intervalRef.current) clearInterval(intervalRef.current);
                  if (isHovered) {
                    intervalRef.current = setInterval(
                      () =>
                        setActiveIndex((idx) => (idx + 1) % images.length),
                      900
                    );
                  }
                }}
                aria-label={`View image ${i + 1}`}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === activeIndex
                    ? "w-4 bg-white shadow-sm"
                    : "w-1 bg-white/40 hover:bg-white/80"
                )}
              />
            ))}
          </div>
        )}

        {/* Title + price — tight to bottom edge, no extra strip below */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[10] bg-gradient-to-t from-black via-black/75 to-transparent px-2.5 pb-2 pt-10 sm:px-3 sm:pb-2.5 sm:pt-11">
          <h3
            className="truncate text-[13px] font-semibold leading-tight tracking-tight text-white drop-shadow-md sm:text-sm"
            title={product.name}
          >
            {product.name}
          </h3>
          <div className="mt-0.5 flex flex-nowrap items-baseline gap-1.5">
            <span className="shrink-0 text-[15px] font-bold tabular-nums tracking-tight text-orange-400 drop-shadow-sm sm:text-base">
              {inr.format(product.price)}
            </span>
            {isSale && typeof product.compareAtPrice === "number" && (
              <span className="min-w-0 truncate text-[11px] tabular-nums text-white/45 line-through">
                {inr.format(product.compareAtPrice)}
              </span>
            )}
          </div>
        </div>

        {onQuickAdd && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-[20] translate-y-full p-2 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover/card:translate-y-0">
            <button
              type="button"
              onClick={onQuick}
              disabled={isOut}
              className={cn(
                "flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold shadow-lg transition-all active:scale-[0.98] sm:gap-2 sm:py-2.5 sm:text-sm",
                addedFlash
                  ? "bg-emerald-600 text-white"
                  : isOut
                    ? "cursor-not-allowed border border-white/10 bg-zinc-800/95 text-zinc-500"
                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:brightness-110"
              )}
            >
              <ShoppingBag className="size-3.5 shrink-0 opacity-95 sm:size-4" />
              {addedFlash ? "Added ✓" : isOut ? "Unavailable" : "Quick add"}
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
