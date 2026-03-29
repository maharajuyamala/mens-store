import type { DocumentData } from "firebase/firestore";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import { computeProductStatus } from "@/lib/products/schema";

export type SortMode = "newest" | "price-asc" | "price-desc" | "match";

export type ExploreProduct = {
  doc_id: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  image: string;
  category?: string;
  tags: string[];
  sizes: string[];
  colors: string[];
  stockStatus: ReturnType<typeof computeProductStatus>;
  stock: number;
  createdAtMs: number;
};

export function isListedProduct(data: DocumentData): boolean {
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
  const images = Array.isArray(data.images)
    ? (data.images as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const single = typeof data.image === "string" ? data.image : "";
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

  const category =
    typeof data.category === "string"
      ? data.category.toLowerCase()
      : undefined;

  let sizes: string[] = [];
  if (Array.isArray(data.sizes)) {
    sizes = data.sizes.map((s) => String(s));
  } else {
    sizes = Object.keys(getSizesMap(data as Record<string, unknown>));
  }

  const colors = Array.isArray(data.colors)
    ? data.colors.map((c) => String(c).toLowerCase().trim())
    : [];

  const stock =
    typeof data.stock === "number" && !Number.isNaN(data.stock)
      ? Math.max(0, Math.floor(data.stock))
      : totalUnits(getSizesMap(data as Record<string, unknown>));

  const stockStatus = computeProductStatus(stock);

  return {
    doc_id: id,
    name: typeof data.name === "string" ? data.name : String(data.name ?? ""),
    price,
    compareAtPrice: compareAt,
    image,
    category,
    tags,
    sizes,
    colors,
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
