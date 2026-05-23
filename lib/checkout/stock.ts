import type { DocumentData } from "firebase/firestore";
import {
  decrementLegacyStock,
  decrementVariantStock,
  hasVariantStock,
  VariantStockError,
} from "@/lib/products/variant-stock-write";
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

/**
 * Build Firestore update for inventory after validating lines for one product.
 * Routes through the variant-aware writer when the product has color variants;
 * otherwise falls back to the legacy single-map / aggregate-stock paths.
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
  const decrements = lines.map((l) => ({
    color: l.color || "",
    size: l.size || "",
    quantity: l.quantity,
  }));

  try {
    if (hasVariantStock(raw)) {
      return decrementVariantStock(raw, decrements);
    }
    return decrementLegacyStock(raw, decrements);
  } catch (err) {
    if (err instanceof VariantStockError) {
      throw new CheckoutStockError(err.message, "INSUFFICIENT_STOCK", productId);
    }
    throw err;
  }
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
