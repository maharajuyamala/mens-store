import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import {
  PRODUCT_CATEGORIES,
  SIZE_OPTIONS,
  computeProductStatus,
  type ProductCategory,
  type ProductSize,
  type ProductStatus,
} from "@/lib/products/schema";

export type ProductTableRow = {
  id: string;
  name: string;
  category: string;
  categoryFilter: ProductCategory | "other";
  price: number;
  stock: number;
  status: ProductStatus;
  active: boolean;
  thumbnail: string | null;
  data: Record<string, unknown>;
};

function isProductCategory(s: string): s is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(s);
}

export function normalizeImageUrls(data: Record<string, unknown>): string[] {
  const imgs = data.images;
  if (Array.isArray(imgs)) {
    return imgs.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  const single = data.image;
  if (typeof single === "string" && single.length > 0) return [single];
  return [];
}

export function resolveCategory(data: Record<string, unknown>): {
  label: string;
  filter: ProductCategory | "other";
} {
  const c = data.category;
  if (typeof c === "string") {
    const low = c.toLowerCase();
    if (isProductCategory(low)) {
      return { label: low, filter: low };
    }
    if (c.length > 0) {
      return { label: c, filter: "other" };
    }
  }
  const tags = data.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      const s = String(t).toLowerCase();
      if (isProductCategory(s)) return { label: s, filter: s };
    }
  }
  return { label: "—", filter: "other" };
}

export function resolveStock(data: Record<string, unknown>): number {
  if (typeof data.stock === "number" && !Number.isNaN(data.stock)) {
    return Math.max(0, Math.floor(data.stock));
  }
  return totalUnits(getSizesMap(data));
}

export function resolvePrice(data: Record<string, unknown>): number {
  const p = data.price;
  if (typeof p === "number" && !Number.isNaN(p)) return p;
  const n = Number(p);
  return Number.isFinite(n) ? n : 0;
}

export function docToProductRow(id: string, data: Record<string, unknown>): ProductTableRow {
  const stock = resolveStock(data);
  const { label, filter } = resolveCategory(data);
  const images = normalizeImageUrls(data);
  const active = data.active !== false;
  return {
    id,
    name: typeof data.name === "string" ? data.name : String(data.name ?? ""),
    category: label,
    categoryFilter: filter,
    price: resolvePrice(data),
    stock,
    status: computeProductStatus(stock),
    active,
    thumbnail: images[0] ?? null,
    data,
  };
}

export function parseSizesFromDoc(data: Record<string, unknown>): ProductSize[] {
  const sizes = data.sizes;
  if (Array.isArray(sizes)) {
    const out: ProductSize[] = [];
    for (const s of sizes) {
      const str = String(s);
      if ((SIZE_OPTIONS as readonly string[]).includes(str)) {
        out.push(str as ProductSize);
      }
    }
    if (out.length > 0) return out;
  }
  const map = getSizesMap(data);
  return Object.keys(map).filter((k) =>
    (SIZE_OPTIONS as readonly string[]).includes(k)
  ) as ProductSize[];
}
