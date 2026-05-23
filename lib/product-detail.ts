import type { DocumentData } from "firebase/firestore";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import { docToExploreProduct, isListedProduct } from "@/lib/explore/types";
import { computeProductStatus, type ProductStatus } from "@/lib/products/schema";
import {
  flattenVariantImages,
  parseColorVariants,
  sizesForColor,
  stockForColorSize,
  totalStockFromVariants,
  type ColorVariant,
} from "@/lib/products/color-variants";

export type ProductDetail = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category?: string;
  tags: string[];
  /** Default image pool (flat list — used as fallback before a color is picked). */
  images: string[];
  colors: string[];
  /** Per-color image groups. Empty for legacy products without variants. */
  colorVariants: ColorVariant[];
  /** Union of every size the product is offered in (across colors). */
  sizes: string[];
  /**
   * Stock for a given size — color-aware when the product has variants.
   * If `color` is omitted, returns the union across all colors so legacy
   * callers continue to work.
   */
  stockForSize: (size: string, color?: string) => number;
  /** Per-color stock map. Returns the variant's full size map (zeros included). */
  sizesForColor: (color: string) => Record<string, number>;
  /** Sizes a customer can actually buy for a given color. */
  availableSizesForColor: (color: string) => string[];
  totalStock: number;
  stockStatus: ProductStatus;
};

function collectImages(data: DocumentData): string[] {
  const images = Array.isArray(data.images)
    ? (data.images as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const single = typeof data.image === "string" ? data.image : "";
  const list = [...images];
  if (single && !list.includes(single)) list.unshift(single);
  return list.filter(Boolean);
}

/**
 * Parse a Firestore product document for the PDP. Returns null if unlisted (inactive / inactive status).
 */
export function parseProductDetail(
  id: string,
  data: DocumentData
): ProductDetail | null {
  if (!isListedProduct(data)) return null;

  const raw = data as Record<string, unknown>;
  const name =
    typeof data.name === "string" ? data.name : String(data.name ?? "Product");
  const description =
    typeof data.description === "string" ? data.description : "";

  const category =
    typeof data.category === "string"
      ? data.category.toLowerCase().trim()
      : undefined;

  const tags = Array.isArray(data.tags)
    ? data.tags.map((t) => String(t).toLowerCase())
    : [];

  const price =
    typeof data.price === "number" && !Number.isNaN(data.price)
      ? data.price
      : Number(data.price) || 0;

  let compareAtPrice: number | undefined;
  const ca = data.compareAtPrice;
  if (typeof ca === "number" && !Number.isNaN(ca)) compareAtPrice = ca;
  else if (typeof ca === "string") {
    const n = Number(ca);
    if (!Number.isNaN(n)) compareAtPrice = n;
  }

  const colorVariants = parseColorVariants(raw);
  const colorsFromField = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
    : [];
  const colors =
    colorVariants.length > 0
      ? colorVariants.map((v) => v.color)
      : colorsFromField;

  const sizesField = data.sizes;
  const isStringSizeArray =
    Array.isArray(sizesField) &&
    sizesField.length > 0 &&
    sizesField.every((x) => typeof x === "string");

  // `getSizesMap` already unions variants, so this branch covers both
  // variant-aware and legacy single-map products.
  const sizesMap = getSizesMap(raw);
  let sizes: string[];
  let stockForSizeFn: (size: string, color?: string) => number;
  let totalStock: number;

  if (colorVariants.length > 0) {
    sizes = Object.keys(sizesMap);
    totalStock = totalStockFromVariants(colorVariants);
    stockForSizeFn = (s, color) => {
      if (color) return stockForColorSize(colorVariants, color, s);
      // No color picked yet → show how many units exist across all colors so
      // the size pill isn't disabled prematurely.
      return Math.max(0, Math.floor(sizesMap[s] ?? 0));
    };
  } else if (isStringSizeArray) {
    sizes = [...(sizesField as string[])];
    totalStock =
      typeof data.stock === "number" && !Number.isNaN(data.stock)
        ? Math.max(0, Math.floor(data.stock))
        : 0;
    stockForSizeFn = () => totalStock;
  } else if (Object.keys(sizesMap).length > 0) {
    sizes = Object.keys(sizesMap);
    totalStock = totalUnits(sizesMap);
    stockForSizeFn = (s) => Math.max(0, Math.floor(sizesMap[s] ?? 0));
  } else {
    sizes = [];
    totalStock =
      typeof data.stock === "number" && !Number.isNaN(data.stock)
        ? Math.max(0, Math.floor(data.stock))
        : 0;
    stockForSizeFn = () => totalStock;
  }

  const stockStatus = computeProductStatus(totalStock);

  const sizesForColorFn = (color: string) =>
    sizesForColor(colorVariants, color);
  const availableSizesForColorFn = (color: string) => {
    const m = sizesForColor(colorVariants, color);
    return Object.entries(m)
      .filter(([, n]) => Number(n) > 0)
      .map(([k]) => k);
  };

  // Prefer flattened variant images so the gallery isn't out of sync when the
  // legacy `images` field wasn't kept up to date.
  const variantImages = flattenVariantImages(colorVariants);
  const baseImages = variantImages.length > 0 ? variantImages : collectImages(data);

  return {
    id,
    name,
    description,
    price,
    compareAtPrice,
    category,
    tags,
    images: baseImages,
    colors,
    colorVariants,
    sizes,
    stockForSize: stockForSizeFn,
    sizesForColor: sizesForColorFn,
    availableSizesForColor: availableSizesForColorFn,
    totalStock,
    stockStatus,
  };
}

export function formatCategoryLabel(slug: string | undefined): string {
  if (!slug) return "Catalog";
  return slug
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export function discountPercent(price: number, compareAt: number): number {
  if (compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

export function pickRelatedProducts(
  docs: Array<{ id: string; data: () => DocumentData }>,
  currentId: string,
  category: string | undefined,
  limit: number
) {
  if (!category) return [];
  const cat = category.toLowerCase();
  const list = docs
    .filter((d) => d.id !== currentId && isListedProduct(d.data()))
    .map((d) => docToExploreProduct(d.id, d.data()))
    .filter(
      (p) =>
        p.stockStatus !== "out_of_stock" &&
        p.category &&
        p.category.toLowerCase() === cat
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, limit);
  return list;
}
