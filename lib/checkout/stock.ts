import type { DocumentData } from "firebase/firestore";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import type { CartItem } from "@/store/cartStore";

export class CheckoutStockError extends Error {
  constructor(
    message: string,
    public readonly code: "MISSING_PRODUCT" | "INSUFFICIENT_STOCK" | "NO_STOCK_FIELD",
    public readonly productId?: string
  ) {
    super(message);
    this.name = "CheckoutStockError";
  }
}

function isStringSizeArray(sizes: unknown): boolean {
  return (
    Array.isArray(sizes) &&
    sizes.length > 0 &&
    sizes.every((x) => typeof x === "string")
  );
}

/** Numeric `stock` or string that parses as a number (admin forms often save strings). */
function parseTopLevelStock(raw: Record<string, unknown>): number | null {
  const v = raw.stock;
  if (typeof v === "number" && !Number.isNaN(v)) {
    return Math.max(0, Math.floor(v));
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return Math.max(0, Math.floor(n));
  }
  return null;
}

/**
 * Build Firestore update for inventory after validating lines for one product.
 * Supports:
 * - `sizes` as a map of size → count (decrements per cart line; writes `sizes` + `stock` total)
 * - `sizes` as string[] with numeric `stock` (aggregate decrement only)
 * - No per-size map: top-level `stock` only
 */
export function buildInventoryUpdate(
  productId: string,
  data: DocumentData,
  lines: CartItem[]
): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw new CheckoutStockError("Product not found", "MISSING_PRODUCT", productId);
  }

  const raw = data as Record<string, unknown>;
  const stringSizes = isStringSizeArray(raw.sizes);
  const totalQty = lines.reduce((s, l) => s + l.quantity, 0);
  const topLevel = parseTopLevelStock(raw);

  const map = { ...getSizesMap(raw) };
  if (Object.keys(map).length > 0) {
    for (const line of lines) {
      const sz = line.size || "";
      const cur = map[sz] ?? 0;
      if (line.quantity > cur) {
        throw new CheckoutStockError(
          `Not enough stock for size ${sz || "(default)"}.`,
          "INSUFFICIENT_STOCK",
          productId
        );
      }
      map[sz] = cur - line.quantity;
    }
    return { sizes: map, stock: totalUnits(map) };
  }

  if (topLevel === null) {
    throw new CheckoutStockError(
      stringSizes
        ? "This product lists sizes but has no stock total. Set the Stock field in admin (or use per-size quantities in the sizes map)."
        : "This product cannot be fulfilled online (missing stock field).",
      "NO_STOCK_FIELD",
      productId
    );
  }

  if (totalQty > topLevel) {
    throw new CheckoutStockError(
      "Not enough stock available.",
      "INSUFFICIENT_STOCK",
      productId
    );
  }

  return { stock: topLevel - totalQty };
}

export function groupLinesByProductId(items: CartItem[]): Map<string, CartItem[]> {
  const m = new Map<string, CartItem[]>();
  for (const item of items) {
    const list = m.get(item.productId) ?? [];
    list.push(item);
    m.set(item.productId, list);
  }
  return m;
}
