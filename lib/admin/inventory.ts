import { computeProductStatus } from "@/lib/products/schema";
import {
  parseColorVariants,
  stockForColorSize as variantStockForColorSize,
  unionVariantSizes,
} from "@/lib/products/color-variants";

/**
 * Normalize product inventory from Firestore. Priority:
 *   1. `colorVariants[].sizes`  — modern per-color/per-size shape (union)
 *   2. `sizes` map              — legacy single-map shape
 *   3. `size: [map]` array      — earliest legacy shape
 *
 * Returns the size → count map. For variant docs this is the union across
 * colors so legacy callers that only think in (size → qty) still work.
 */
export function getSizesMap(data: Record<string, unknown>): Record<string, number> {
  const variants = parseColorVariants(data);
  if (variants.length > 0) {
    const union = unionVariantSizes(variants);
    if (Object.keys(union).length > 0) return union;
  }
  const sizes = data.sizes;
  if (sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
    return Object.fromEntries(
      Object.entries(sizes as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "number" ? v : Number(v) || 0,
      ])
    );
  }
  const size = data.size;
  if (Array.isArray(size) && size[0] && typeof size[0] === "object") {
    return Object.fromEntries(
      Object.entries(size[0] as Record<string, unknown>).map(([k, v]) => [
        k,
        typeof v === "number" ? v : Number(v) || 0,
      ])
    );
  }
  return {};
}

/**
 * Stock for one (color, size). Prefers variant data; falls back to the union
 * size map when the product doesn't use variants. Used by storefront stock
 * checks and the order-place transaction.
 */
export function getStockForLine(
  data: Record<string, unknown>,
  color: string | null | undefined,
  size: string | null | undefined
): number {
  const variants = parseColorVariants(data);
  if (variants.length > 0 && color) {
    return variantStockForColorSize(variants, color, size);
  }
  const map = getSizesMap(data);
  if (size && Object.keys(map).length > 0) {
    const n = map[size];
    return typeof n === "number" && Number.isFinite(n)
      ? Math.max(0, Math.floor(n))
      : 0;
  }
  // No per-size map: fall back to top-level stock if any.
  const stock = data.stock;
  if (typeof stock === "number" && Number.isFinite(stock)) {
    return Math.max(0, Math.floor(stock));
  }
  if (typeof stock === "string" && stock.trim() !== "") {
    const n = Number(stock);
    if (Number.isFinite(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

export function totalUnits(sizes: Record<string, number>): number {
  return Object.values(sizes).reduce((a, b) => a + b, 0);
}

/** Products in `low_stock` status (1–5 units with current status rules). */
export function countLowStockProducts(
  docs: Array<{ data: () => Record<string, unknown> }>
): number {
  let n = 0;
  for (const d of docs) {
    const data = d.data();
    const stock =
      typeof data.stock === "number" && !Number.isNaN(data.stock)
        ? Math.max(0, Math.floor(data.stock))
        : totalUnits(getSizesMap(data));
    if (computeProductStatus(stock) === "low_stock") n += 1;
  }
  return n;
}
