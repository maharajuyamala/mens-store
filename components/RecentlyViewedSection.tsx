"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (ids.length === 0) {
      setProducts([]);
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

  if (ids.length === 0 && !loading) return null;

  const isDark = variant === "dark";

  return (
    <section
      className={cn(
        "py-10",
        isDark ? "border-y border-gray-800 bg-gray-950/80" : "border-y border-border"
      )}
      aria-label="Recently viewed"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2
          className={cn(
            "mb-4 text-lg font-semibold tracking-tight",
            isDark ? "text-white" : "text-foreground"
          )}
        >
          Recently viewed
        </h2>
        {loading && products.length === 0 ? (
          <p
            className={cn(
              "text-sm",
              isDark ? "text-gray-500" : "text-muted-foreground"
            )}
          >
            Loading…
          </p>
        ) : null}
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:px-0">
          {products.map((p) => (
            <Link
              key={p.doc_id}
              href={`/product-details?id=${encodeURIComponent(p.doc_id)}`}
              className={cn(
                "w-36 shrink-0 overflow-hidden rounded-xl border transition-shadow hover:shadow-md",
                isDark
                  ? "border-gray-800 bg-gray-900"
                  : "border-border bg-card"
              )}
            >
              <div className="relative aspect-[3/4] w-full bg-muted">
                {p.image ? (
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    className="object-cover"
                    sizes="144px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="space-y-0.5 p-2">
                <p
                  className={cn(
                    "line-clamp-2 text-xs font-medium leading-tight",
                    isDark ? "text-gray-100" : "text-foreground"
                  )}
                >
                  {p.name}
                </p>
                <p className="text-xs font-semibold text-orange-500">
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
