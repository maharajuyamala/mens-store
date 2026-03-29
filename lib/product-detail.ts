import type { DocumentData } from "firebase/firestore";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import { docToExploreProduct, isListedProduct } from "@/lib/explore/types";
import { computeProductStatus, type ProductStatus } from "@/lib/products/schema";

export type ProductDetail = {
  id: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category?: string;
  tags: string[];
  images: string[];
  colors: string[];
  sizes: string[];
  stockForSize: (size: string) => number;
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

  const colors = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c).toLowerCase().trim()).filter(Boolean)
    : [];

  const sizesField = data.sizes;
  const isStringSizeArray =
    Array.isArray(sizesField) &&
    sizesField.length > 0 &&
    sizesField.every((x) => typeof x === "string");

  const sizesMap = getSizesMap(raw);
  let sizes: string[];
  let stockForSize: (size: string) => number;
  let totalStock: number;

  if (isStringSizeArray) {
    sizes = [...(sizesField as string[])];
    totalStock =
      typeof data.stock === "number" && !Number.isNaN(data.stock)
        ? Math.max(0, Math.floor(data.stock))
        : 0;
    stockForSize = () => totalStock;
  } else if (Object.keys(sizesMap).length > 0) {
    sizes = Object.keys(sizesMap);
    totalStock = totalUnits(sizesMap);
    stockForSize = (s) => Math.max(0, Math.floor(sizesMap[s] ?? 0));
  } else {
    sizes = [];
    totalStock =
      typeof data.stock === "number" && !Number.isNaN(data.stock)
        ? Math.max(0, Math.floor(data.stock))
        : 0;
    stockForSize = () => totalStock;
  }

  const stockStatus = computeProductStatus(totalStock);

  return {
    id,
    name,
    description,
    price,
    compareAtPrice,
    category,
    tags,
    images: collectImages(data),
    colors,
    sizes,
    stockForSize,
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
      (p) => p.category && p.category.toLowerCase() === cat
    )
    .sort((a, b) => b.createdAtMs - a.createdAtMs)
    .slice(0, limit);
  return list;
}
