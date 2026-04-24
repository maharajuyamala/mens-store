"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentData } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronRight,
  Heart,
  Minus,
  Package,
  Plus,
  ShoppingCart,
} from "lucide-react";
import { ExploreProductCard } from "@/components/explore/ExploreProductCard";
import { Button } from "@/components/ui/button";
import { swatchColor } from "@/lib/explore/color-swatches";
import type { ExploreProduct } from "@/lib/explore/types";
import {
  discountPercent,
  formatCategoryLabel,
  parseProductDetail,
  type ProductDetail,
} from "@/lib/product-detail";
import { cn, inr as currency } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { useWishlistStore } from "@/store/wishlistStore";
import { toast } from "sonner";

function stockBadgeCopy(product: ProductDetail): string {
  if (product.stockStatus === "out_of_stock") return "Out of stock";
  if (product.stockStatus === "low_stock") {
    return `Only ${product.totalStock} left`;
  }
  return "In stock";
}

type ProductDetailsClientProps = {
  productId: string | null;
  initialProductData: Record<string, unknown> | null;
  initialRelated: ExploreProduct[];
};

function ProductDetailContent({
  productId,
  initialProductData,
  initialRelated,
}: ProductDetailsClientProps) {
  const product = useMemo(() => {
    if (!productId || !initialProductData) return null;
    return parseProductDetail(productId, initialProductData as DocumentData);
  }, [productId, initialProductData]);

  const related = initialRelated;
  const [mainIndex, setMainIndex] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [descOpen, setDescOpen] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const inWishlist = useWishlistStore((s) =>
    productId ? s.ids.includes(productId) : false
  );
  const toggleWishlistStore = useWishlistStore((s) => s.toggle);
  const recordView = useRecentlyViewedStore((s) => s.recordView);

  useEffect(() => {
    setMainIndex(0);
  }, [productId, product?.id]);

  useEffect(() => {
    if (!productId || !product) return;
    recordView(productId);
  }, [productId, product, recordView]);

  useEffect(() => {
    if (!product) return;
    const first =
      product.sizes.find((s) => product.stockForSize(s) > 0) ??
      product.sizes[0] ??
      null;
    setSelectedSize(first);
    setSelectedColor(product.colors[0] ?? "");
    setQty(1);
  }, [product]);

  const maxQty = useMemo(() => {
    if (!product) return 0;
    if (product.sizes.length === 0) return product.totalStock;
    if (!selectedSize) return 0;
    return product.stockForSize(selectedSize);
  }, [product, selectedSize]);

  useEffect(() => {
    if (maxQty <= 0) return;
    setQty((q) => Math.min(Math.max(1, q), maxQty));
  }, [maxQty]);

  const mainSrc = product?.images[mainIndex] ?? product?.images[0] ?? "";

  const isSale =
    product &&
    typeof product.compareAtPrice === "number" &&
    product.compareAtPrice > product.price;

  const pctOff =
    product && isSale && product.compareAtPrice
      ? discountPercent(product.price, product.compareAtPrice)
      : 0;

  const descLong = (product?.description.length ?? 0) > 280;

  const toggleWishlist = useCallback(() => {
    if (!productId) return;
    toggleWishlistStore(productId);
  }, [productId, toggleWishlistStore]);

  const addToCart = useCallback(() => {
    if (!product) return;
    const size = product.sizes.length ? selectedSize ?? "" : "";
    const color = product.colors.length ? selectedColor : "";
    if (product.sizes.length > 0 && !selectedSize) return;
    if (product.colors.length > 0 && !selectedColor) return;
    if (maxQty <= 0) return;

    addItem({
      productId: product.id,
      name: product.name,
      size,
      color,
      quantity: qty,
      price: product.price,
      image: product.images[0] ?? "",
    });
    toast.success("Added to cart", { description: product.name });
  }, [product, selectedSize, selectedColor, maxQty, qty, addItem]);

  const canAdd =
    !!product &&
    maxQty > 0 &&
    (product.sizes.length === 0 || !!selectedSize) &&
    (product.colors.length === 0 || !!selectedColor);

  if (!productId) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 text-center">
        <Package className="mx-auto h-14 w-14 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link is missing a product id.
        </p>
        <Button asChild className="mt-8 bg-orange-600 hover:bg-orange-500">
          <Link href="/explore">Browse shop</Link>
        </Button>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background pt-28 pb-16 text-center">
        <Package className="mx-auto h-14 w-14 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">Product not found</h1>
        <p className="mt-2 max-w-md mx-auto text-muted-foreground">
          We couldn&apos;t load this product. It may have been removed or the
          link is incorrect.
        </p>
        <Button asChild className="mt-8 bg-orange-600 hover:bg-orange-500">
          <Link href="/explore">Back to shop</Link>
        </Button>
      </div>
    );
  }

  const categoryLabel = formatCategoryLabel(product.category);
  const exploreCategoryHref = product.category
    ? `/explore?category=${encodeURIComponent(product.category)}`
    : "/explore";

  return (
    <div className="min-h-screen bg-background pt-24 pb-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav
          className="mb-8 flex flex-wrap items-center gap-1 text-sm text-muted-foreground"
          aria-label="Breadcrumb"
        >
          <Link href="/" className="hover:text-foreground transition-colors">
            Home
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          <Link
            href={exploreCategoryHref}
            className="hover:text-foreground transition-colors"
          >
            {categoryLabel}
          </Link>
          <ChevronRight className="h-4 w-4 shrink-0 opacity-60" />
          <span className="line-clamp-1 font-medium text-foreground max-w-[min(100%,12rem)] sm:max-w-md">
            {product.name}
          </span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <div>
            <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
              <AnimatePresence mode="wait">
                {mainSrc ? (
                  <motion.div
                    key={mainSrc}
                    className="absolute inset-0"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeInOut" }}
                  >
                    <Image
                      src={mainSrc}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={mainIndex === 0}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="placeholder"
                    className="flex h-full min-h-[200px] items-center justify-center text-muted-foreground"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    No image
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            {product.images.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {product.images.map((src, i) => (
                  <button
                    key={`${src}-${i}`}
                    type="button"
                    onClick={() => setMainIndex(i)}
                    className={cn(
                      "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-colors",
                      i === mainIndex
                        ? "border-orange-500 ring-2 ring-orange-500/30"
                        : "border-transparent hover:border-border"
                    )}
                    aria-label={`Show image ${i + 1}`}
                  >
                    <Image
                      src={src}
                      alt=""
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                {product.name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-2xl font-semibold text-orange-600">
                  {currency.format(product.price)}
                </span>
                {isSale && product.compareAtPrice ? (
                  <>
                    <span className="text-lg text-muted-foreground line-through">
                      {currency.format(product.compareAtPrice)}
                    </span>
                    {pctOff > 0 ? (
                      <span className="rounded-full bg-orange-600/15 px-2.5 py-0.5 text-sm font-semibold text-orange-700 dark:text-orange-400">
                        {pctOff}% off
                      </span>
                    ) : null}
                  </>
                ) : null}
              </div>
            </div>

            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium",
                product.stockStatus === "out_of_stock" &&
                  "border-destructive/40 text-destructive",
                product.stockStatus === "low_stock" &&
                  "border-amber-500/50 text-amber-800 dark:text-amber-200",
                product.stockStatus === "in_stock" &&
                  "border-emerald-500/40 text-emerald-800 dark:text-emerald-200"
              )}
            >
              <Package className="h-4 w-4" />
              {stockBadgeCopy(product)}
            </div>

            {product.sizes.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Size</p>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => {
                    const stock = product.stockForSize(s);
                    const disabled = stock <= 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedSize(s)}
                        className={cn(
                          "min-w-[2.75rem] rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          disabled &&
                            "cursor-not-allowed opacity-40 line-through",
                          !disabled &&
                            selectedSize === s &&
                            "border-orange-500 bg-orange-500 text-white",
                          !disabled &&
                            selectedSize !== s &&
                            "border-border hover:border-orange-500/50"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {product.colors.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-medium">Color</p>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((c) => {
                    const fill = swatchColor(c);
                    const selected = selectedColor === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={cn(
                          "relative h-9 w-9 rounded-full border-2 transition-shadow",
                          selected
                            ? "border-orange-500 ring-2 ring-orange-500/35"
                            : "border-border hover:border-orange-500/40"
                        )}
                        style={{ backgroundColor: fill }}
                        title={c}
                        aria-label={`Color ${c}`}
                      >
                        <span className="sr-only">{c}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-sm font-medium">Quantity</p>
              <div className="flex w-fit items-center gap-3 rounded-full border border-border px-2 py-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={qty <= 1 || maxQty <= 0}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="min-w-[2ch] text-center text-lg font-semibold tabular-nums">
                  {qty}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full"
                  disabled={qty >= maxQty || maxQty <= 0}
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <Button
                type="button"
                className="h-12 w-full rounded-lg bg-orange-600 px-8 text-base font-semibold text-white hover:bg-orange-500 sm:w-auto sm:min-w-[min(100%,16rem)]"
                disabled={!canAdd}
                onClick={addToCart}
              >
                <ShoppingCart className="size-5 shrink-0" />
                Add to cart
              </Button>
              <Button
                type="button"
                variant="outline"
                className={cn(
                  "h-12 w-full rounded-lg border-2 px-8 text-base font-semibold sm:w-auto sm:min-w-[min(100%,12rem)]",
                  inWishlist &&
                    "border-orange-500 bg-orange-500/10 text-orange-600"
                )}
                onClick={toggleWishlist}
                aria-pressed={inWishlist}
                aria-label={
                  inWishlist ? "Remove from wishlist" : "Add to wishlist"
                }
              >
                <Heart
                  className={cn(
                    "mr-2 h-5 w-5",
                    inWishlist && "fill-current"
                  )}
                />
                Wishlist
              </Button>
            </div>
            <div className="border-t border-border pt-6">
              <h2 className="text-lg font-semibold">Description</h2>
              <div
                className={cn(
                  "mt-2 text-muted-foreground leading-relaxed whitespace-pre-wrap",
                  !descOpen && descLong && "line-clamp-4"
                )}
              >
                {product.description || "No description for this product yet."}
              </div>
              {descLong ? (
                <button
                  type="button"
                  onClick={() => setDescOpen((o) => !o)}
                  className="mt-2 text-sm font-semibold text-orange-600 hover:text-orange-500 dark:text-orange-400"
                >
                  {descOpen ? "Show less" : "Read more"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {related.length > 0 ? (
          <section className="mt-16 border-t border-border pt-12">
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              You may also like
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              More from {categoryLabel}
            </p>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {related.map((p) => (
                <ExploreProductCard key={p.doc_id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

export function ProductDetailsClient(props: ProductDetailsClientProps) {
  return <ProductDetailContent {...props} />;
}
