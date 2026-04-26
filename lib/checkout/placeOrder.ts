import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type DocumentSnapshot,
  type UpdateData,
} from "firebase/firestore";
import { getDb } from "@/app/firebase";
import type { DeliveryFormValues } from "@/lib/checkout/deliverySchema";
import type { PricingBreakdown } from "@/lib/checkout/pricing";
import {
  buildInventoryUpdate,
  CheckoutStockError,
  groupLinesByProductId,
} from "@/lib/checkout/stock";
import type { OrderShippingRecord } from "@/lib/shiprocket/types";
import type { CartItem } from "@/store/cartStore";

const ORDER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateOrderNumber(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ORDER_CHARS[buf[i]! % ORDER_CHARS.length];
  }
  return s;
}

export type PlaceOrderInput = {
  items: CartItem[];
  shippingAddress: DeliveryFormValues;
  pricing: PricingBreakdown;
  couponCode: string | null;
  paymentMethod: "cod" | "online";
  userId: string;
  /** Optional tag for reporting (e.g. in-store POS). */
  saleChannel?: "web" | "pos";
  /** Optional courier integration record (Shiprocket). Persisted on the order doc. */
  shipping?: OrderShippingRecord;
  /** Reuse a pre-generated order number (e.g. shared with Shiprocket). */
  orderNumber?: string;
};

export type PlacedOrder = {
  orderId: string;
  orderNumber: string;
};

function orderItemsPayload(items: CartItem[]) {
  return items.map(
    ({ productId, name, image, price, size, color, quantity }) => ({
      productId,
      name,
      image,
      price,
      size,
      color,
      quantity,
    })
  );
}

export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  const { items } = input;
  if (items.length === 0) {
    throw new Error("Cart is empty");
  }

  const db = getDb();
  const orderRef = doc(collection(db, "orders"));
  const orderNumber = input.orderNumber ?? generateOrderNumber();

  const pricingPayload = {
    subtotal: input.pricing.subtotal,
    discount: input.pricing.discount,
    shipping: input.pricing.shipping,
    total: input.pricing.total,
    couponCode: input.couponCode,
  };

  const shippingPayload = {
    fullName: input.shippingAddress.fullName,
    email: input.shippingAddress.email,
    phone: input.shippingAddress.phone,
    line1: input.shippingAddress.line1,
    line2: input.shippingAddress.line2 ?? "",
    city: input.shippingAddress.city,
    state: input.shippingAddress.state,
    pincode: input.shippingAddress.pincode,
  };

  const orderPayload = {
    userId: input.userId,
    items: orderItemsPayload(items),
    shippingAddress: shippingPayload,
    pricing: pricingPayload,
    status: "pending" as const,
    paymentMethod: input.paymentMethod,
    createdAt: serverTimestamp(),
    orderNumber,
    ...(input.saleChannel ? { saleChannel: input.saleChannel } : {}),
    ...(input.shipping ? { shipping: input.shipping } : {}),
  };

  await runTransaction(db, async (tx) => {
    const byProduct = groupLinesByProductId(items);
    const snaps = new Map<string, DocumentSnapshot>();

    for (const productId of byProduct.keys()) {
      const pref = doc(db, "products", productId);
      const snap = await tx.get(pref);
      snaps.set(productId, snap);
    }

    const patches = new Map<string, Record<string, unknown>>();
    for (const [productId, lines] of byProduct) {
      const snap = snaps.get(productId);
      if (!snap?.exists()) {
        throw new CheckoutStockError(
          "A product in your cart is no longer available.",
          "MISSING_PRODUCT",
          productId
        );
      }
      const patch = buildInventoryUpdate(
        productId,
        snap.data()!,
        lines
      );
      patches.set(productId, patch);
    }

    for (const [productId, patch] of patches) {
      tx.update(
        doc(db, "products", productId),
        patch as UpdateData<Record<string, unknown>>
      );
    }

    tx.set(orderRef, orderPayload);

    if (input.userId !== "guest") {
      const userOrderRef = doc(
        db,
        "users",
        input.userId,
        "orders",
        orderRef.id
      );
      tx.set(userOrderRef, orderPayload);
    }
  });

  return { orderId: orderRef.id, orderNumber };
}
