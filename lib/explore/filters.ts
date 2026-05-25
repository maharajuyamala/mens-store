import type { ExploreProduct, SortMode } from "@/lib/explore/types";
import {
  PRODUCT_AUDIENCES,
  PRODUCT_CATEGORIES,
  type ProductAudience,
} from "@/lib/products/schema";

export const EXPLORE_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export const LEGACY_TAGS = [
  "sport",
  "sports",
  "casual",
  "formal",
  "party",
  "shirts",
  "pants",
  "shorts",
  "undergarments",
  "luxury",
  // Silhouette tags exposed in the admin "Style & type" chips (Women / Kids).
  "top",
  "bottom",
] as const;

/** Categories shown in filter = admin categories + legacy tags + any seen on products */
export function categoryFilterOptions(products: ExploreProduct[]): string[] {
  const set = new Set<string>([
    ...PRODUCT_CATEGORIES,
    ...PRODUCT_AUDIENCES,
    ...LEGACY_TAGS,
  ]);
  products.forEach((p) => {
    if (p.category) set.add(p.category);
    p.tags.forEach((t) => set.add(t));
  });
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function uniqueColors(products: ExploreProduct[]): string[] {
  const set = new Set<string>();
  products.forEach((p) => p.colors.forEach((c) => set.add(c)));
  return [...set].sort((a, b) => a.localeCompare(b));
}

export type ExploreFilterInput = {
  categories: string[];
  audience: ProductAudience | "all";
  sizes: string[];
  colors: string[];
  priceMin: number;
  priceMax: number;
  inStockOnly: boolean;
  sort: SortMode;
  query: string;
};

export function productMatchesCategory(p: ExploreProduct, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const cat = (p.category ?? "").toLowerCase();
  const aud = p.audience.toLowerCase();
  const lowerTags = p.tags.map((t) => t.toLowerCase());
  const lowerCats = p.categories.map((c) => c.toLowerCase());
  return selected.some((rawSel) => {
    const s = rawSel.toLowerCase();
    if (!s) return false;
    return (
      cat === s ||
      aud === s ||
      lowerTags.includes(s) ||
      lowerCats.includes(s)
    );
  });
}

export function productMatchesAudience(
  p: ExploreProduct,
  audience: ProductAudience | "all"
): boolean {
  if (audience === "all") return true;
  return p.audience === audience;
}

export function productMatchesSize(p: ExploreProduct, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const set = new Set(p.sizes.map((x) => x.toUpperCase()));
  return selected.some((s) => set.has(s.toUpperCase()));
}

export function productMatchesColor(p: ExploreProduct, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const set = new Set(p.colors);
  return selected.some((c) => set.has(c.toLowerCase()));
}

export function productMatchesPrice(
  p: ExploreProduct,
  min: number,
  max: number
): boolean {
  return p.price >= min && p.price <= max;
}

export function productMatchesInStockOnly(
  p: ExploreProduct,
  only: boolean
): boolean {
  if (!only) return true;
  return p.stock > 0;
}

export function productMatchesQuery(p: ExploreProduct, q: string): boolean {
  const needle = q.trim();
  if (!needle) return true;
  const lower = needle.toLowerCase();
  if (p.name.toLowerCase().includes(lower)) return true;
  // Short variant codes (e.g. "AB12X") — match when the typed query is
  // contained in any of the product's codes, case-insensitive.
  const codeNeedle = needle.toUpperCase().replace(/\s+/g, "");
  if (codeNeedle.length >= 2) {
    if (p.variantCodes.some((c) => c.includes(codeNeedle))) return true;
  }
  return false;
}

export function filterExploreProducts(
  products: ExploreProduct[],
  f: ExploreFilterInput
): ExploreProduct[] {
  return products.filter(
    (p) =>
      productMatchesAudience(p, f.audience) &&
      productMatchesCategory(p, f.categories) &&
      productMatchesSize(p, f.sizes) &&
      productMatchesColor(p, f.colors) &&
      productMatchesPrice(p, f.priceMin, f.priceMax) &&
      productMatchesInStockOnly(p, f.inStockOnly) &&
      productMatchesQuery(p, f.query)
  );
}

function bestMatchScore(p: ExploreProduct, q: string): number {
  if (!q.trim()) return 0;
  const n = p.name.toLowerCase();
  const needle = q.trim().toLowerCase();
  if (n === needle) return 100;
  if (n.startsWith(needle)) return 80;
  if (n.includes(needle)) return 50;
  // Exact variant-code matches sort right behind a name match so that
  // typing a code from a sticker takes the customer straight to the
  // matching card.
  const codeNeedle = q.trim().toUpperCase().replace(/\s+/g, "");
  if (codeNeedle.length >= 2 && p.variantCodes.some((c) => c === codeNeedle)) {
    return 90;
  }
  return 0;
}

export function sortExploreProducts(
  products: ExploreProduct[],
  sort: SortMode,
  query: string
): ExploreProduct[] {
  const copy = [...products];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => b.createdAtMs - a.createdAtMs);
    case "price-asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price-desc":
      return copy.sort((a, b) => b.price - a.price);
    case "match":
    default:
      if (!query.trim()) return copy;
      return copy.sort(
        (a, b) => bestMatchScore(b, query) - bestMatchScore(a, query)
      );
  }
}
