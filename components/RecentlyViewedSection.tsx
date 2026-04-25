"use client";

import Image from "next/image";
import Link from "next/link";
import { useLayoutEffect, useState } from "react";
import { fetchListedProductsByIds } from "@/lib/client/fetch-products-by-ids";
import type { ExploreProduct } from "@/lib/explore/types";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { cn, inr } from "@/lib/utils";

type Variant = "dark" | "light";

export function RecentlyViewedSection({
  variant = "dark",
}: {
  variant?: Variant;
}) {
  const ids = useRecentlyViewedStore((s) => s.ids);
  const [products, setProducts] = useState<ExploreProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const list = await fetchListedProductsByIds(ids);
        if (!cancelled) setProducts(list);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ids]);

  if (ids.length === 0) return null;
  if (!loading && products.length === 0) return null;

  const isDark = variant === "dark";

  return (
    <section
      className={cn(
        "border-t border-border/60 py-5 sm:py-6",
        isDark ? "bg-card/30" : "bg-muted/20"
      )}
      aria-label="Recently viewed"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2
          className={cn(
            "mb-3 text-xs font-semibold uppercase tracking-wider",
            isDark ? "text-zinc-500" : "text-muted-foreground"
          )}
        >
          Recently viewed
        </h2>
        {loading && products.length === 0 ? (
          <p
            className={cn(
              "text-xs",
              isDark ? "text-zinc-500" : "text-muted-foreground"
            )}
          >
            Loading…
          </p>
        ) : null}
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 pt-0.5 sm:mx-0 sm:gap-3 sm:px-0 [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
          {products.map((p) => (
            <Link
              key={p.doc_id}
              href={`/product-details?id=${encodeURIComponent(p.doc_id)}`}
              className={cn(
                "w-[5.5rem] shrink-0 overflow-hidden rounded-lg border transition-shadow hover:shadow-md sm:w-24",
                "border-border bg-card"
              )}
            >
              <div className="relative aspect-[3/4] w-full bg-muted">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-0.5 p-1.5">
                <p
                  className={cn(
                    "line-clamp-2 text-[10px] font-medium leading-tight sm:text-xs",
                    isDark ? "text-zinc-200" : "text-foreground"
                  )}
                >
                  {p.name}
                </p>
                <p className="text-[10px] font-semibold text-orange-500 sm:text-xs">
                  {inr.format(p.price)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
