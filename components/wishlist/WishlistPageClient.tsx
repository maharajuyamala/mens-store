"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { ExploreProductCard } from "@/components/explore/ExploreProductCard";
import { Button } from "@/components/ui/button";
import { fetchListedProductsByIds } from "@/lib/client/fetch-products-by-ids";
import type { ExploreProduct } from "@/lib/explore/types";
import { useWishlistStore } from "@/store/wishlistStore";

export function WishlistPageClient() {
  const ids = useWishlistStore((s) => s.ids);
  const [products, setProducts] = useState<ExploreProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  return (
    <div className="min-h-screen bg-background pb-24 pt-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Wishlist
            </h1>
            <p className="mt-2 text-muted-foreground">
              Pieces you&apos;ve saved for later.
            </p>
          </div>
          {ids.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => useWishlistStore.getState().clear()}
            >
              Clear all
            </Button>
          ) : null}
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading saved items…</p>
        ) : ids.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center">
            <Heart className="h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium">Your wishlist is empty</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Tap the heart on a product card or product page to save it here.
            </p>
            <Button
              asChild
              className="mt-8 bg-orange-600 hover:bg-orange-500"
            >
              <Link href="/explore">Browse shop</Link>
            </Button>
          </div>
        ) : products.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">
              Saved items are unavailable or were removed from the catalog.
            </p>
            <Button asChild variant="link" className="mt-4">
              <Link href="/explore">Back to shop</Link>
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {products.map((p, i) => (
              <ExploreProductCard key={p.doc_id} product={p} imagePriority={i < 3} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
