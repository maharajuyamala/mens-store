import { getFirebaseAuth } from "@/app/firebase";
import type { CartItem } from "@/store/cartStore";
import type { DeliveryFormValues } from "@/lib/checkout/deliverySchema";

export type PlaceOrderServerResponse = {
  ok: true;
  orderId: string;
  orderNumber: string;
  pricing: {
    subtotal: number;
    discount: number;
    shipping: number;
    total: number;
    advancePaid: number;
    balanceDue: number;
    couponCode: string | null;
  };
  paymentMethod: "cod" | "online";
  paymentStatus: "paid" | "partial" | "due";
  items: Array<{
    productId: string;
    name: string;
    image: string;
    price: number;
    size: string;
    color: string;
    quantity: number;
  }>;
};

export class PlaceOrderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "PlaceOrderError";
  }
}

export async function placeOrderViaServer(input: {
  items: CartItem[];
  shippingAddress: DeliveryFormValues;
  paymentMethod: "cod" | "online";
  couponCode: string | null;
  discount: number;
  payment?: {
    orderId: string;
    cfPaymentId: string;
  };
}): Promise<PlaceOrderServerResponse> {
  // Best-effort auth token so guest checkout keeps working when signed out.
  let authHeader: Record<string, string> = {};
  try {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (u) {
      const token = await u.getIdToken();
      authHeader = { Authorization: `Bearer ${token}` };
    }
  } catch {
    // No firebase configured / not signed in — proceed as guest.
  }

  const body = {
    items: input.items.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
      size: i.size || undefined,
      color: i.color || undefined,
    })),
    shippingAddress: input.shippingAddress,
    paymentMethod: input.paymentMethod,
    couponCode: input.couponCode,
    discount: input.discount,
    payment: input.payment
      ? {
          orderId: input.payment.orderId,
          cfPaymentId: input.payment.cfPaymentId,
        }
      : undefined,
  };

  const res = await fetch("/api/orders/place", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeader },
    body: JSON.stringify(body),
  });

  const json = (await res.json().catch(() => null)) as
    | PlaceOrderServerResponse
    | { error?: string; message?: string }
    | null;

  if (!res.ok || !json || !("ok" in json) || !json.ok) {
    const code = (json && "error" in json && json.error) || "order_failed";
    const message =
      (json && "message" in json && json.message) ||
      "Could not place your order.";
    throw new PlaceOrderError(code, message, res.status);
  }

  return json;
}
