import { FieldPath, type Firestore } from "firebase-admin/firestore";

export type OrderItemInput = {
  productId: string;
  quantity: number;
  size?: string;
  color?: string;
};

export type RecomputedPricing = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  /** Resolved product info per line — server is source of truth for name, image, price. */
  lines: Array<{
    productId: string;
    name: string;
    image: string;
    price: number;
    size: string;
    color: string;
    quantity: number;
  }>;
};

export class OrderValidationError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "OrderValidationError";
  }
}

function readNum(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function readImage(data: Record<string, unknown>): string {
  const arr = data.images;
  if (Array.isArray(arr)) {
    const first = arr.find((x): x is string => typeof x === "string" && x.length > 0);
    if (first) return first;
  }
  if (typeof data.image === "string") return data.image;
  return "";
}

function availableForLine(
  data: Record<string, unknown>,
  size: string
): number {
  const sizes = data.sizes;
  if (size && sizes && typeof sizes === "object" && !Array.isArray(sizes)) {
    const v = (sizes as Record<string, unknown>)[size];
    const n = readNum(v);
    return n === null ? 0 : Math.max(0, Math.floor(n));
  }
  const stock = readNum(data.stock);
  return stock === null ? 0 : Math.max(0, Math.floor(stock));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Server-authoritative pricing. Fetches every product in the cart, validates
 * it's listed (not archived/inactive), validates per-line stock, multiplies by
 * the server-side price. Coupon discount is optional and capped at subtotal.
 *
 * Shipping is hardcoded free per business rule — change here if that policy
 * ever changes; do not accept a shipping amount from the client.
 */
export async function recomputeOrderPricing(
  db: Firestore,
  items: OrderItemInput[],
  options: { discount?: number } = {}
): Promise<RecomputedPricing> {
  if (items.length === 0) {
    throw new OrderValidationError("EMPTY_CART", "Cart is empty.");
  }

  const productIds = [...new Set(items.map((i) => i.productId))];
  const productMap = new Map<string, Record<string, unknown>>();

  for (const batch of chunk(productIds, 10)) {
    const snap = await db
      .collection("products")
      .where(FieldPath.documentId(), "in", batch)
      .get();
    for (const d of snap.docs) {
      productMap.set(d.id, d.data() as Record<string, unknown>);
    }
  }

  const lines: RecomputedPricing["lines"] = [];
  let subtotal = 0;

  for (const item of items) {
    const data = productMap.get(item.productId);
    if (!data) {
      throw new OrderValidationError(
        "MISSING_PRODUCT",
        `Product ${item.productId} no longer exists.`
      );
    }
    if (data.archived === true || data.active === false) {
      throw new OrderValidationError(
        "UNLISTED_PRODUCT",
        `${typeof data.name === "string" ? data.name : "A product"} is no longer for sale.`
      );
    }
    const price = readNum(data.price);
    if (price === null || price < 0) {
      throw new OrderValidationError(
        "INVALID_PRICE",
        `Product ${item.productId} has no valid price.`
      );
    }
    const qty = Math.floor(item.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new OrderValidationError(
        "INVALID_QUANTITY",
        `Quantity for ${item.productId} is invalid.`
      );
    }
    const available = availableForLine(data, item.size ?? "");
    if (qty > available) {
      throw new OrderValidationError(
        "INSUFFICIENT_STOCK",
        `${typeof data.name === "string" ? data.name : "A product"}${
          item.size ? ` (size ${item.size})` : ""
        }: only ${available} available.`
      );
    }
    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
    lines.push({
      productId: item.productId,
      name: typeof data.name === "string" ? data.name : "Item",
      image: readImage(data),
      price,
      size: item.size ?? "",
      color: item.color ?? "",
      quantity: qty,
    });
  }

  const discount = Math.min(Math.max(0, options.discount ?? 0), subtotal);
  const shipping = 0; // business rule: shipping always free.
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;

  return { subtotal, discount, shipping, total, lines };
}
