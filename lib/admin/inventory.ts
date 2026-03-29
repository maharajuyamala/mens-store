import { computeProductStatus } from "@/lib/products/schema";

/**
 * Normalize product inventory from Firestore (supports `sizes` map or legacy `size: [map]`).
 */
export function getSizesMap(data: Record<string, unknown>): Record<string, number> {
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
