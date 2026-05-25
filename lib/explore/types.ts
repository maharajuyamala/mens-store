import type { DocumentData } from "firebase/firestore";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import {
  computeProductStatus,
  type ProductAudience,
} from "@/lib/products/schema";
import {
  collectVariantCodes,
  flattenVariantImages,
  parseColorVariants,
  type ColorVariant,
} from "@/lib/products/color-variants";

export type SortMode = "newest" | "price-asc" | "price-desc" | "match";

export type ExploreProduct = {
  doc_id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  images: string[];
  category?: string;
  /** Department: men / women / kids (defaults to men when missing in Firestore). */
  audience: ProductAudience;
  tags: string[];
  /**
   * Friendly category names persisted by the admin form
   * (e.g. `["Plain Shirts", "Designer Shirts"]`). Stored on Firestore as a
   * comma-separated string under the `categories` field; parsed here so the
   * explore filter can do a case-insensitive match.
   */
  categories: string[];
  /** Sizes the customer can actually buy (per-size stock > 0 when known). */
  sizes: string[];
  /** Per-size available units. Empty when product has no size map (legacy flat stock). */
  sizesStock: Record<string, number>;
  colors: string[];
  /**
   * Per-color image groups. Empty when the product doesn't have variants —
   * consumers should fall back to `images` in that case.
   */
  colorVariants: ColorVariant[];
  /**
   * Short 5-char codes — one per color variant — for search and labels.
   * Reads the persisted `variantCodes` field when present; falls back to
   * deterministic hashing so legacy products are still searchable by code.
   */
  variantCodes: string[];
  stockStatus: ReturnType<typeof computeProductStatus>;
  stock: number;
  createdAtMs: number;
};

export function isListedProduct(data: DocumentData): boolean {
  if (data.archived === true) return false;
  if (data.active === false) return false;
  if (data.status === "inactive") return false;
  return true;
}

function createdAtToMs(data: DocumentData): number {
  const c = data.createdAt;
  if (c && typeof c === "object" && "toMillis" in c && typeof (c as { toMillis: () => number }).toMillis === "function") {
    return (c as { toMillis: () => number }).toMillis();
  }
  if (c && typeof c === "object" && "seconds" in c) {
    const s = (c as { seconds: number }).seconds;
    return typeof s === "number" ? s * 1000 : 0;
  }
  return 0;
}

export function docToExploreProduct(id: string, data: DocumentData): ExploreProduct {
  const colorVariants = parseColorVariants(data as Record<string, unknown>);
  const flatImagesField = Array.isArray(data.images)
    ? (data.images as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const single = typeof data.image === "string" ? data.image : "";
  // Prefer flattened variant images so the listing always reflects the actual
  // product photography even when the legacy `images` field is stale.
  const variantImages = flattenVariantImages(colorVariants);
  const images = variantImages.length > 0 ? variantImages : flatImagesField;
  const image = images[0] ?? single ?? "";

  const price =
    typeof data.price === "number" && !Number.isNaN(data.price)
      ? data.price
      : Number(data.price) || 0;

  let compareAt: number | undefined;
  const ca = data.compareAtPrice;
  if (typeof ca === "number" && !Number.isNaN(ca)) compareAt = ca;
  else if (typeof ca === "string") {
    const n = Number(ca);
    if (!Number.isNaN(n)) compareAt = n;
  }

  const tags = Array.isArray(data.tags)
    ? data.tags.map((t) => String(t).toLowerCase())
    : [];

  // `categories` is written as a comma-separated string by the admin forms.
  // Tolerate legacy/alt shapes (array, missing) so older docs still parse.
  let categories: string[] = [];
  const catsRaw = data.categories;
  if (typeof catsRaw === "string") {
    categories = catsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (Array.isArray(catsRaw)) {
    categories = catsRaw.map((s) => String(s).trim()).filter(Boolean);
  }

  const category =
    typeof data.category === "string"
      ? data.category.toLowerCase()
      : undefined;

  let audience: ProductAudience = "men";
  const audRaw = data.audience;
  if (typeof audRaw === "string") {
    const a = audRaw.toLowerCase();
    if (a === "women" || a === "kids" || a === "men") audience = a;
  }

  // `getSizesMap` already unions variant sizes when colorVariants exist, so
  // the listing card / filters keep seeing a single per-size view.
  const sizesMap = getSizesMap(data as Record<string, unknown>);
  const hasSizesMap = Object.keys(sizesMap).length > 0;
  let sizes: string[];
  if (hasSizesMap) {
    sizes = Object.entries(sizesMap)
      .filter(([, v]) => Number(v) > 0)
      .map(([k]) => k);
  } else if (Array.isArray(data.sizes)) {
    sizes = data.sizes.map((s) => String(s));
  } else {
    sizes = [];
  }

  const colorsFromField = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
    : [];
  // Variants are the source of truth when present; fall back to the legacy
  // flat `colors` array otherwise.
  const colors =
    colorVariants.length > 0
      ? colorVariants.map((v) => v.color)
      : colorsFromField;

  // Per-size stock map (kept only when we actually have one; empty for legacy flat-stock docs).
  const sizesStock: Record<string, number> = {};
  if (hasSizesMap) {
    for (const [k, v] of Object.entries(sizesMap)) {
      const n = Math.max(0, Math.floor(Number(v) || 0));
      sizesStock[k] = n;
    }
  }

  const stock = hasSizesMap
    ? totalUnits(sizesMap)
    : typeof data.stock === "number" && !Number.isNaN(data.stock)
      ? Math.max(0, Math.floor(data.stock))
      : 0;

  const stockStatus = computeProductStatus(stock);

  // Variant codes — read the flat list off the doc when available, else
  // compute deterministically so search keeps working for legacy products
  // that were saved before the field existed.
  const storedCodes = Array.isArray(data.variantCodes)
    ? (data.variantCodes as unknown[])
        .map((c) => (typeof c === "string" ? c.trim().toUpperCase() : ""))
        .filter((c) => c.length > 0)
    : [];
  const variantCodes =
    storedCodes.length > 0
      ? storedCodes
      : collectVariantCodes(id, colorVariants);

  return {
    doc_id: id,
    name: typeof data.name === "string" ? data.name : String(data.name ?? ""),
    price,
    compareAtPrice: compareAt,
    image,
    images,
    category,
    audience,
    tags,
    categories,
    sizes,
    sizesStock,
    colors,
    colorVariants,
    variantCodes,
    stockStatus,
    stock,
    createdAtMs: createdAtToMs(data),
  };
}

export function priceBounds(products: ExploreProduct[]): [number, number] {
  if (products.length === 0) return [0, 500];
  const prices = products.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return [Math.max(0, min - 1), max + 1];
  return [Math.floor(min), Math.ceil(max)];
}
