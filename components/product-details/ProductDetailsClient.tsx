"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DocumentData } from "firebase/firestore";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronRight,
  Copy,
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
import {
  imagesForColor,
  variantCode as resolveVariantCode,
  variantLabel,
} from "@/lib/products/color-variants";
import { normalizeVariantCode } from "@/lib/products/variant-code";
import { cn, inr as currency } from "@/lib/utils";
import { useCartStore } from "@/store/cartStore";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";

// 1×1 dark-zinc PNG used as a blur placeholder so the main image fades in
// from the card background instead of flashing white.
const BLUR_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=";
import { useWishlistStore } from "@/store/wishlistStore";
import { toast } from "sonner";

/**
 * Decide whether a swatch fill is "light" enough that a white tick mark on
 * top of it would disappear. Accepts hex (#rgb / #rrggbb) and css colour
 * strings like `hsl(...)`. Returns false for anything we can't parse, which
 * is the safer default — a white check + dark drop shadow stays readable on
 * mid-tone colours.
 */
function isLightSwatch(fill: string | undefined): boolean {
  if (!fill) return false;
  const trimmed = fill.trim();
  if (trimmed.startsWith("#")) {
    const h = trimmed.slice(1).toLowerCase();
    const normalized =
      h.length === 3
        ? h
            .split("")
            .map((c) => c + c)
            .join("")
        : h;
    if (!/^[0-9a-f]{6}$/.test(normalized)) return false;
    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);
    // YIQ brightness — anything above ~160 reads as light.
    return (r * 299 + g * 587 + b * 114) / 1000 > 165;
  }
  // hsl(h s% l%) — light if lightness > 65%.
  const hsl = trimmed.match(/hsl\([^)]*\s(\d{1,3})%\s*\)/i);
  if (hsl?.[1]) return Number(hsl[1]) > 65;
  return false;
}

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
  const searchParams = useSearchParams();
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
  const [codeCopied, setCodeCopied] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const inWishlist = useWishlistStore((s) =>
    productId ? s.ids.includes(productId) : false
  );
  const toggleWishlistStore = useWishlistStore((s) => s.toggle);
  const recordView = useRecentlyViewedStore((s) => s.recordView);

  useEffect(() => {
    setMainIndex(0);
  }, [productId, product?.id, selectedColor]);

  useEffect(() => {
    if (!productId || !product) return;
    recordView(productId);
  }, [productId, product, recordView]);

  // Pick the initial color. If the URL carries `?c=<code>`, prefer the
  // variant whose code matches so deep-links land on the right colorway.
  // Otherwise pick the first colour that actually has stock.
  useEffect(() => {
    if (!product) return;
    let initialColor = "";
    const wantedCode = normalizeVariantCode(searchParams.get("c"));
    if (wantedCode && product.colorVariants.length > 0) {
      const match = product.colorVariants.find(
        (v) => resolveVariantCode(product.id, v) === wantedCode
      );
      if (match) initialColor = match.color;
    }
    if (!initialColor) {
      if (product.colorVariants.length > 0) {
        initialColor =
          product.colorVariants.find((v) =>
            Object.values(v.sizes).some((q) => Number(q) > 0)
          )?.color ?? product.colors[0] ?? "";
      } else if (product.colors.length > 0) {
        initialColor = product.colors[0]!;
      }
    }
    setSelectedColor(initialColor);
    setQty(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product]);

  // Active variant + its code (used in the URL and the badge).
  const activeVariant = useMemo(() => {
    if (!product) return null;
    return (
      product.colorVariants.find((v) => v.color === selectedColor) ?? null
    );
  }, [product, selectedColor]);

  const activeCode = useMemo(() => {
    if (!product) return "";
    if (activeVariant) return resolveVariantCode(product.id, activeVariant);
    // Legacy product without variants — fall back to the first stored code
    // (or empty) so we don't fabricate a colour out of thin air.
    return "";
  }, [product, activeVariant]);

  // Keep the URL in lockstep with the chosen colour — `?c=<code>` — so a
  // shared link always reopens on the matching variant. Uses history.replace
  // (not router.push) to avoid polluting the back-stack on every click.
  useEffect(() => {
    if (typeof window === "undefined" || !product) return;
    const url = new URL(window.location.href);
    const current = url.searchParams.get("c") ?? "";
    if (activeCode) {
      if (current === activeCode) return;
      url.searchParams.set("c", activeCode);
    } else {
      if (!current) return;
      url.searchParams.delete("c");
    }
    window.history.replaceState({}, "", url.toString());
  }, [activeCode, product]);

  // When the color changes (or on first mount), pick the first size that
  // actually has stock *for that color*. Falls back to any size if none are
  // stocked (the buy button stays disabled in that case).
  useEffect(() => {
    if (!product) return;
    const stockFor = (s: string) =>
      product.stockForSize(s, selectedColor || undefined);
    const first =
      product.sizes.find((s) => stockFor(s) > 0) ??
      product.sizes[0] ??
      null;
    setSelectedSize(first);
  }, [product, selectedColor]);

  const maxQty = useMemo(() => {
    if (!product) return 0;
    if (product.sizes.length === 0) return product.totalStock;
    if (!selectedSize) return 0;
    return product.stockForSize(selectedSize, selectedColor || undefined);
  }, [product, selectedSize, selectedColor]);

  useEffect(() => {
    if (maxQty <= 0) return;
    setQty((q) => Math.min(Math.max(1, q), maxQty));
  }, [maxQty]);

  /**
   * Gallery for the selected color. Falls back to the product image pool when
   * the product has no variants or the variant has no images yet.
   */
  const displayImages = useMemo<string[]>(() => {
    if (!product) return [];
    if (product.colorVariants.length > 0) {
      return imagesForColor(
        product.colorVariants,
        selectedColor || null,
        product.images
      );
    }
    return product.images;
  }, [product, selectedColor]);

  const mainSrc = displayImages[mainIndex] ?? displayImages[0] ?? "";

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
      image: displayImages[0] ?? product.images[0] ?? "",
    });
    toast.success("Added to cart", {
      description: product.name,
      duration: 1000,
    });
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
                      className="object-cover object-top"
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      priority={mainIndex === 0}
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
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
            {displayImages.length > 1 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {displayImages.map((src, i) => (
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
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {product.name}
                </h1>
                {activeCode ? (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(activeCode);
                        setCodeCopied(true);
                        toast.success(`Copied code ${activeCode}`);
                        window.setTimeout(() => setCodeCopied(false), 1400);
                      } catch {
                        /* clipboard unavailable */
                      }
                    }}
                    title="Variant code — tap to copy"
                    className={cn(
                      "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] transition-colors",
                      codeCopied
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-muted/40 text-foreground/85 hover:border-orange-500/60 hover:text-orange-600"
                    )}
                    aria-label={`Variant code ${activeCode} — tap to copy`}
                  >
                    {codeCopied ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 opacity-70" />
                    )}
                    {activeCode}
                  </button>
                ) : null}
              </div>
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
                <div className="mb-2 flex items-baseline gap-2">
                  <p className="text-sm font-medium">Size</p>
                  {product.colorVariants.length > 0 && selectedColor ? (
                    <span className="text-xs text-muted-foreground">
                      Stock shown for {selectedColor}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((s) => {
                    const stock = product.stockForSize(
                      s,
                      selectedColor || undefined
                    );
                    const disabled = stock <= 0;
                    return (
                      <button
                        key={s}
                        type="button"
                        disabled={disabled}
                        onClick={() => setSelectedSize(s)}
                        title={
                          disabled
                            ? selectedColor
                              ? `Out of stock in ${selectedColor}`
                              : "Out of stock"
                            : `${stock} in stock`
                        }
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
                <div className="mb-2 flex items-baseline gap-2">
                  <p className="text-sm font-medium">Color</p>
                  {selectedColor ? (
                    <span className="text-sm text-muted-foreground">
                      {(() => {
                        const v = product.colorVariants.find(
                          (x) => x.color === selectedColor
                        );
                        return v ? variantLabel(v) : selectedColor;
                      })()}
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((c) => {
                    const variant = product.colorVariants.find(
                      (v) => v.color === c
                    );
                    const fill = variant?.hex ?? swatchColor(c);
                    const selected = selectedColor === c;
                    const label = variant ? variantLabel(variant) : c;
                    // When variants exist, grey out a color that has no
                    // stock in any size so the customer doesn't get a dead
                    // size grid after picking it.
                    const variantStock = variant
                      ? Object.values(variant.sizes).reduce(
                          (a, b) => a + (Number(b) || 0),
                          0
                        )
                      : null;
                    const soldOut = variantStock === 0;
                    const light = isLightSwatch(fill);
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setSelectedColor(c)}
                        className={cn(
                          "relative h-10 w-10 rounded-full border transition-colors",
                          // Neutral border for every state — no orange highlight.
                          "border-border hover:border-foreground/30",
                          soldOut && "opacity-40"
                        )}
                        style={{ backgroundColor: fill }}
                        title={soldOut ? `${label} — sold out` : label}
                        aria-label={`Color ${label}${soldOut ? ", sold out" : ""}`}
                        aria-pressed={selected}
                      >
                        <span className="sr-only">{label}</span>
                        {selected ? (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                          >
                            <Check
                              className={cn(
                                "h-5 w-5",
                                light ? "text-zinc-900" : "text-white",
                                light
                                  ? "drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)]"
                                  : "drop-shadow-[0_1px_1px_rgba(0,0,0,0.55)]"
                              )}
                              strokeWidth={3}
                            />
                          </span>
                        ) : null}
                        {soldOut ? (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-1 rounded-full border-t-2"
                            style={{
                              transform: "rotate(-45deg)",
                              borderColor: "rgba(0,0,0,0.55)",
                            }}
                          />
                        ) : null}
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
