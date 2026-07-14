import { FieldPath, type Firestore } from "firebase-admin/firestore";
import { getSizesMap, getStockForLine, totalUnits } from "@/lib/admin/inventory";
import { parseColorVariants } from "@/lib/products/color-variants";
import { FREE_SHIPPING_THRESHOLD_INR } from "@/lib/checkout/constants";
import { computeGstBreakdown, type GstBreakdown } from "@/lib/checkout/gst";
import { shiprocketGet, ShiprocketError } from "@/lib/shiprocket/client";

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
  gst: GstBreakdown;
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
  size: string,
  color: string
): number {
  // Prefer the variant-aware lookup when the product has color variants —
  // this enforces "M in wine has 1 left but M in navy is sold out" semantics.
  const variants = parseColorVariants(data);
  if (variants.length > 0 && color) {
    return getStockForLine(data, color, size || null);
  }
  // Legacy paths: single union size map, or aggregate `stock` field.
  const map = getSizesMap(data);
  const hasMap = Object.keys(map).length > 0;
  if (size && hasMap) {
    const n = map[size];
    return typeof n === "number" && Number.isFinite(n)
      ? Math.max(0, Math.floor(n))
      : 0;
  }
  if (hasMap) return totalUnits(map);
  const stock = readNum(data.stock);
  return stock === null ? 0 : Math.max(0, Math.floor(stock));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type ShiprocketServiceabilityBody = {
  data?: {
    available_courier_companies?: Array<{
      rate?: number | string;
      freight_charge?: number | string;
    }>;
  };
};

/** Assume every apparel item weighs 0.5kg unless the product doc says otherwise. */
const DEFAULT_LINE_WEIGHT_KG = 0.5;

function readLineWeight(data: Record<string, unknown>): number {
  const raw = data.weightKg ?? data.weight;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return DEFAULT_LINE_WEIGHT_KG;
}

/**
 * Fetch the cheapest quoted courier rate from Shiprocket for a given
 * delivery pincode. Returns null when Shiprocket is unreachable, misconfigured,
 * or returns no priced couriers — callers fall back to zero shipping so the
 * order can still be placed. (Serviceability itself is fail-open by design;
 * see /api/shiprocket/serviceability for the rationale.)
 */
async function fetchShiprocketRate(input: {
  pickupPincode: string;
  deliveryPincode: string;
  weightKg: number;
  cod: boolean;
}): Promise<number | null> {
  const params = new URLSearchParams({
    pickup_postcode: input.pickupPincode,
    delivery_postcode: input.deliveryPincode,
    weight: String(input.weightKg),
    cod: input.cod ? "1" : "0",
  });
  try {
    const body = await shiprocketGet<ShiprocketServiceabilityBody>(
      `/courier/serviceability/?${params.toString()}`
    );
    const couriers = body?.data?.available_courier_companies ?? [];
    let cheapest: number | null = null;
    for (const c of couriers) {
      const raw = c.rate ?? c.freight_charge;
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      if (cheapest === null || n < cheapest) cheapest = n;
    }
    return cheapest;
  } catch (e) {
    if (e instanceof ShiprocketError) {
      console.warn("[recompute-pricing] shiprocket rate lookup failed", e.message);
      return null;
    }
    throw e;
  }
}

export type ShippingContext = {
  /** Delivery pincode captured at checkout. Required for rate lookup. */
  deliveryPincode?: string;
  /** COD flag — Shiprocket rates depend on whether the shipment is COD or Prepaid. */
  cod?: boolean;
};

/**
 * Server-authoritative pricing. Fetches every product in the cart, validates
 * it's listed (not archived/inactive), validates per-line stock, multiplies by
 * the server-side price. Coupon discount is optional and capped at subtotal.
 *
 * Shipping is looked up from Shiprocket using the delivery pincode when one
 * is provided — we never trust a shipping amount from the client. If lookup
 * fails or no pincode is supplied, shipping is treated as 0 so the order can
 * still be placed. Product prices are GST-inclusive; the returned `gst` field
 * breaks out the embedded tax for the invoice.
 */
export async function recomputeOrderPricing(
  db: Firestore,
  items: OrderItemInput[],
  options: { discount?: number; shippingContext?: ShippingContext } = {}
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
  let totalWeightKg = 0;

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
    const available = availableForLine(data, item.size ?? "", item.color ?? "");
    if (qty > available) {
      const desc = [item.color ? item.color : null, item.size ? `size ${item.size}` : null]
        .filter(Boolean)
        .join(" / ");
      throw new OrderValidationError(
        "INSUFFICIENT_STOCK",
        `${typeof data.name === "string" ? data.name : "A product"}${
          desc ? ` (${desc})` : ""
        }: only ${available} available.`
      );
    }
    const lineTotal = Math.round(price * qty * 100) / 100;
    subtotal = Math.round((subtotal + lineTotal) * 100) / 100;
    totalWeightKg += readLineWeight(data) * qty;
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
  const discountedSubtotal = Math.round((subtotal - discount) * 100) / 100;

  // Free-delivery threshold short-circuits the courier lookup entirely — no
  // point paying for a rate quote we're going to zero out.
  const qualifiesForFreeShipping =
    FREE_SHIPPING_THRESHOLD_INR > 0 &&
    discountedSubtotal >= FREE_SHIPPING_THRESHOLD_INR;

  // Shipping: only quote when we have a delivery pincode + configured pickup.
  // Any failure (missing config, Shiprocket down, no priced couriers) falls
  // back to zero so the order still succeeds.
  const pickupPincode = process.env.SHIPROCKET_PICKUP_PINCODE?.trim() ||
    process.env.NEXT_PUBLIC_SHIPROCKET_PICKUP_PINCODE?.trim() ||
    "";
  const deliveryPincode = options.shippingContext?.deliveryPincode?.trim() ?? "";
  let shipping = 0;
  if (
    !qualifiesForFreeShipping &&
    pickupPincode &&
    /^\d{6}$/.test(pickupPincode) &&
    /^\d{6}$/.test(deliveryPincode) &&
    totalWeightKg > 0
  ) {
    const rate = await fetchShiprocketRate({
      pickupPincode,
      deliveryPincode,
      weightKg: Math.round(totalWeightKg * 100) / 100,
      cod: options.shippingContext?.cod ?? false,
    });
    if (rate !== null && rate >= 0) {
      shipping = Math.round(rate * 100) / 100;
    }
  }

  const gst = computeGstBreakdown(
    lines.map((l) => ({ price: l.price, quantity: l.quantity })),
    discount,
    shipping
  );
  const total = Math.round((subtotal - discount + shipping) * 100) / 100;

  return { subtotal, discount, shipping, gst, total, lines };
}
