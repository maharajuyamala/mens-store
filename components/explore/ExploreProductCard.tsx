"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, ShoppingBag } from "lucide-react";
import type { ExploreProduct } from "@/lib/explore/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWishlistStore } from "@/store/wishlistStore";

type Props = {
  product: ExploreProduct;
  onQuickAdd?: (product: ExploreProduct) => void;
  /** LCP: prioritize first grid images (e.g. first row). */
  imagePriority?: boolean;
};

export function ExploreProductCard({
  product,
  onQuickAdd,
  imagePriority = false,
}: Props) {
  const [addedFlash, setAddedFlash] = useState(false);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const inWishlist = useWishlistStore((s) => s.ids.includes(product.doc_id));

  const onQuick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onQuickAdd) return;
    onQuickAdd(product);
    setAddedFlash(true);
    window.setTimeout(() => setAddedFlash(false), 1200);
  };

  const isSale =
    typeof product.compareAtPrice === "number" &&
    product.compareAtPrice > product.price;

  const isLow = product.stockStatus === "low_stock";

  const href = `/product-details?id=${product.doc_id}`;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
      <div className="relative">
        <Link href={href} className="block">
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
            {product.image ? (
              <motion.div
                className="relative h-full w-full"
                whileHover={{ scale: 1.06 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              >
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  priority={imagePriority}
                />
              </motion.div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No image
              </div>
            )}
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute right-2 top-2 z-20 h-9 w-9 rounded-full border border-border/80 bg-background/90 shadow-md backdrop-blur-sm hover:bg-background"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleWishlist(product.doc_id);
              }}
              aria-label={
                inWishlist ? "Remove from wishlist" : "Add to wishlist"
              }
              aria-pressed={inWishlist}
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  inWishlist && "fill-orange-500 text-orange-500"
                )}
              />
            </Button>
            <div className="pointer-events-none absolute left-2 top-2 flex flex-wrap gap-1">
              {isLow ? (
                <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-medium text-black">
                  Low stock
                </span>
              ) : null}
              {isSale ? (
                <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-medium text-white">
                  Sale
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        {onQuickAdd ? (
          <Button
            type="button"
            className={cn(
              "absolute bottom-3 left-3 right-3 z-10 h-12 rounded-lg bg-orange-600 px-4 text-sm font-semibold text-white shadow-lg transition-opacity duration-200 hover:bg-orange-500",
              "opacity-0 group-hover:opacity-100"
            )}
            onClick={onQuick}
          >
            <ShoppingBag className="size-5 shrink-0" />
            {addedFlash ? "Added" : "Quick add"}
          </Button>
        ) : null}
      </div>
      <Link href={href} className="block space-y-1 p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-semibold sm:text-base">
          {product.name}
        </h3>
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-base font-semibold text-orange-500 sm:text-lg">
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
            }).format(product.price)}
          </span>
          {isSale ? (
            <span className="text-sm text-muted-foreground line-through">
              {new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "USD",
              }).format(product.compareAtPrice!)}
            </span>
          ) : null}
        </div>
        {onQuickAdd && addedFlash ? (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Added to bag
          </p>
        ) : null}
      </Link>
    </div>
  );
}
