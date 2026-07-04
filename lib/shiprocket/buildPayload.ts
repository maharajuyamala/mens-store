import type {
  ShiprocketAdhocOrderPayload,
  ShiprocketOrderItem,
  ShiprocketPaymentMethod,
} from "@/lib/shiprocket/types";

export type BuildPayloadInput = {
  orderNumber: string;
  createdAt: Date;
  paymentMethod: "cod" | "online";
  items: Array<{
    productId?: string;
    name: string;
    price: number;
    quantity: number;
    size?: string;
    color?: string;
  }>;
  shippingAddress: {
    fullName: string;
    email: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
  };
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    /** Online advance already collected (Cashfree). Courier only collects total − advancePaid. */
    advancePaid?: number;
  };
};

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] ?? "Customer", last: "." };
  return { first: parts[0]!, last: parts.slice(1).join(" ") };
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function packageDims() {
  const dims = {
    length: readNumber("SHIPROCKET_PACKAGE_LENGTH_CM", 25),
    breadth: readNumber("SHIPROCKET_PACKAGE_BREADTH_CM", 20),
    height: readNumber("SHIPROCKET_PACKAGE_HEIGHT_CM", 5),
    perItemWeightKg: readNumber("SHIPROCKET_PER_ITEM_WEIGHT_KG", 0.5),
    minWeightKg: readNumber("SHIPROCKET_MIN_WEIGHT_KG", 0.5),
  };
  // Defensive: a misconfigured 0/negative env var would cause Shiprocket to reject the order
  // with a confusing error. Fail fast with a clear message instead.
  for (const [k, v] of Object.entries(dims)) {
    if (!Number.isFinite(v) || v <= 0) {
      throw new Error(
        `Shiprocket package config invalid: ${k} must be > 0 (got ${v}). Check SHIPROCKET_PACKAGE_* env vars.`
      );
    }
  }
  return dims;
}

function toSku(item: BuildPayloadInput["items"][number]): string {
  const base = item.productId || item.name.replace(/\s+/g, "-").slice(0, 24);
  const size = item.size ? `-${item.size}` : "";
  const color = item.color ? `-${item.color}` : "";
  return `${base}${size}${color}`.toUpperCase();
}

function buildItems(items: BuildPayloadInput["items"]): ShiprocketOrderItem[] {
  return items.map((i) => ({
    name: i.name,
    sku: toSku(i),
    units: Math.max(1, Math.floor(i.quantity)),
    selling_price: Math.max(0, Number(i.price.toFixed(2))),
  }));
}

export function buildShiprocketPayload(
  input: BuildPayloadInput
): ShiprocketAdhocOrderPayload {
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION;
  if (!pickupLocation) {
    throw new Error(
      "SHIPROCKET_PICKUP_LOCATION is not set. Use the nickname of a pickup location registered in Shiprocket."
    );
  }

  const { first, last } = splitName(input.shippingAddress.fullName);
  const dims = packageDims();
  const totalUnits = input.items.reduce(
    (n, i) => n + Math.max(1, Math.floor(i.quantity)),
    0
  );
  const weight = Math.max(
    dims.minWeightKg,
    Number((totalUnits * dims.perItemWeightKg).toFixed(3))
  );

  const paymentMethod: ShiprocketPaymentMethod =
    input.paymentMethod === "cod" ? "COD" : "Prepaid";

  const orderDate = input.createdAt
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  // For COD with an online advance, only the balance is collected by the courier.
  // Shiprocket reads `sub_total` as the COD collection amount, so we send the
  // post-advance balance here for COD; for Prepaid we send the real subtotal.
  const advancePaid = Math.max(0, Number(input.pricing.advancePaid ?? 0));
  const codCollection = Math.max(
    0,
    Number((input.pricing.total - advancePaid).toFixed(2))
  );
  const subTotal =
    paymentMethod === "COD"
      ? codCollection
      : Number(input.pricing.subtotal.toFixed(2));

  return {
    order_id: input.orderNumber,
    order_date: orderDate,
    pickup_location: pickupLocation,
    billing_customer_name: first,
    billing_last_name: last,
    billing_address: input.shippingAddress.line1,
    billing_address_2: input.shippingAddress.line2 || undefined,
    billing_city: input.shippingAddress.city,
    billing_pincode: input.shippingAddress.pincode,
    billing_state: input.shippingAddress.state,
    billing_country: "India",
    billing_email: input.shippingAddress.email,
    // deliverySchema already normalizes to 10 digits; trust it here.
    billing_phone: input.shippingAddress.phone,
    shipping_is_billing: true,
    order_items: buildItems(input.items),
    payment_method: paymentMethod,
    shipping_charges: Number(input.pricing.shipping.toFixed(2)),
    total_discount:
      paymentMethod === "COD"
        ? 0
        : Number(input.pricing.discount.toFixed(2)),
    sub_total: subTotal,
    length: dims.length,
    breadth: dims.breadth,
    height: dims.height,
    weight,
  };
}
