/**
 * Variant-aware inventory writers. Build the Firestore patch for a product
 * after a set of (color, size, qty) decrements (orders) or a single delta
 * (manual restock). Keeps the legacy `sizes` + `stock` mirrors in sync so any
 * code that hasn't been migrated to read `colorVariants` still sees totals.
 */

import {
  parseColorVariants,
  sanitizeVariantForWrite,
  totalStockFromVariants,
  unionVariantSizes,
  type ColorVariant,
} from "@/lib/products/color-variants";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import { computeProductStatus } from "@/lib/products/schema";

export class VariantStockError extends Error {
  constructor(
    public readonly code: "MISSING_VARIANT" | "MISSING_SIZE" | "INSUFFICIENT_STOCK",
    message: string
  ) {
    super(message);
    this.name = "VariantStockError";
  }
}

export type DecrementLine = {
  /** Cart color (lowercase). May be empty for legacy products with no colors. */
  color: string;
  /** Size key. May be empty for products that don't track sizes. */
  size: string;
  /** Positive integer quantity to subtract. */
  quantity: number;
};

type Patch = Record<string, unknown>;

/**
 * Whether the product is using the variant-aware (per-color/per-size) shape.
 * Pure read; used by both the order-place transaction and the POS path.
 */
export function hasVariantStock(data: Record<string, unknown>): boolean {
  const variants = parseColorVariants(data);
  if (variants.length === 0) return false;
  // The product *has* colorVariants; treat it as variant-aware even if some
  // colors currently have empty sizes maps — we want writes to target the
  // variant array, not the legacy flat fields.
  return variants.length > 0;
}

/**
 * Decrement a variant-aware product by a list of (color, size, qty) lines.
 * Throws VariantStockError when stock is insufficient or a color/size has
 * been removed since the customer added the item. Returns the Firestore
 * patch (with `colorVariants`, `sizes` union mirror, `stock`, `status`).
 */
export function decrementVariantStock(
  data: Record<string, unknown>,
  lines: readonly DecrementLine[]
): Patch {
  const variants = parseColorVariants(data);
  const next: ColorVariant[] = variants.map((v) => ({
    ...v,
    sizes: { ...v.sizes },
  }));

  for (const line of lines) {
    if (line.quantity <= 0) continue;
    const target = next.find(
      (v) => v.color.toLowerCase() === line.color.toLowerCase()
    );
    if (!target) {
      throw new VariantStockError(
        "MISSING_VARIANT",
        `Color "${line.color}" is no longer available for this product.`
      );
    }
    if (!(line.size in target.sizes)) {
      throw new VariantStockError(
        "MISSING_SIZE",
        `Size "${line.size}" is no longer stocked in ${target.color}.`
      );
    }
    const cur = target.sizes[line.size] ?? 0;
    if (cur < line.quantity) {
      throw new VariantStockError(
        "INSUFFICIENT_STOCK",
        `Only ${cur} left in ${target.color} / ${line.size}.`
      );
    }
    target.sizes[line.size] = cur - line.quantity;
  }

  const sanitized = next.map(sanitizeVariantForWrite);
  const union = unionVariantSizes(sanitized);
  const stockTotal = totalStockFromVariants(sanitized);

  return {
    colorVariants: sanitized,
    sizes: union, // legacy mirror — keeps single-map readers in sync
    stock: stockTotal,
    status: computeProductStatus(stockTotal),
  };
}

/**
 * Apply a positive or negative delta to a single (color, size) cell. Used by
 * the Scan & stock restock flow. For legacy products without variants, this
 * is a no-op (caller falls back to the legacy `applyStockDelta`).
 */
export function applyVariantDelta(
  data: Record<string, unknown>,
  color: string,
  size: string,
  delta: number
): Patch {
  if (!Number.isFinite(delta) || delta === 0) {
    throw new VariantStockError("INSUFFICIENT_STOCK", "Delta must be non-zero.");
  }
  const variants = parseColorVariants(data);
  const next: ColorVariant[] = variants.map((v) => ({
    ...v,
    sizes: { ...v.sizes },
  }));
  const target = next.find(
    (v) => v.color.toLowerCase() === color.toLowerCase()
  );
  if (!target) {
    throw new VariantStockError(
      "MISSING_VARIANT",
      `Color "${color}" is not part of this product.`
    );
  }
  const cur = target.sizes[size] ?? 0;
  const after = cur + delta;
  if (after < 0) {
    throw new VariantStockError(
      "INSUFFICIENT_STOCK",
      `Not enough stock in ${color} / ${size}.`
    );
  }
  target.sizes[size] = after;

  const sanitized = next.map(sanitizeVariantForWrite);
  const union = unionVariantSizes(sanitized);
  const stockTotal = totalStockFromVariants(sanitized);

  return {
    colorVariants: sanitized,
    sizes: union,
    stock: stockTotal,
    status: computeProductStatus(stockTotal),
  };
}

/**
 * Convenience for the legacy single-map decrement path. Returns the patch
 * that updates `sizes` and `stock` while preserving the original storage
 * shape (modern map vs legacy `size: [{...}]` array). Used as the fallback
 * when a product has no colorVariants.
 */
export function decrementLegacyStock(
  data: Record<string, unknown>,
  lines: readonly DecrementLine[]
): Patch {
  const map = { ...getSizesMap(data) };
  const hasMap = Object.keys(map).length > 0;
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

  if (hasMap) {
    for (const line of lines) {
      const key = line.size || "";
      if (!(key in map)) {
        throw new VariantStockError(
          "MISSING_SIZE",
          `Size "${key || "(default)"}" no longer offered.`
        );
      }
      if ((map[key] ?? 0) < line.quantity) {
        throw new VariantStockError(
          "INSUFFICIENT_STOCK",
          `Only ${map[key]} left for size ${key}.`
        );
      }
      map[key] = (map[key] ?? 0) - line.quantity;
    }
    const stockTotal = totalUnits(map);
    const legacySize = data.size;
    const usedLegacy =
      Array.isArray(legacySize) &&
      legacySize[0] &&
      typeof legacySize[0] === "object" &&
      (!data.sizes ||
        typeof data.sizes !== "object" ||
        Array.isArray(data.sizes));
    const patch: Patch = usedLegacy ? { size: [map] } : { sizes: map };
    patch.stock = stockTotal;
    patch.status = computeProductStatus(stockTotal);
    return patch;
  }

  // No per-size data at all — adjust aggregate `stock` only.
  const rawStock =
    typeof data.stock === "number"
      ? data.stock
      : Number(data.stock) || 0;
  if (rawStock < totalQty) {
    throw new VariantStockError(
      "INSUFFICIENT_STOCK",
      `Only ${rawStock} units left.`
    );
  }
  return {
    stock: rawStock - totalQty,
    status: computeProductStatus(rawStock - totalQty),
  };
}
