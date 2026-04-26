import type { OrderShippingRecord } from "@/lib/shiprocket/types";

export type CreateShiprocketOrderInput = {
  orderNumber: string;
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
  };
};

/**
 * Calls the server route to create a Shiprocket order. Always resolves with a
 * record — on failure, returns a record with status "failed" so the order can
 * still be placed in Firestore and admin can retry the booking later.
 */
export async function createShiprocketOrder(
  input: CreateShiprocketOrderInput
): Promise<OrderShippingRecord> {
  try {
    const res = await fetch("/api/shiprocket/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok?: boolean; shipping?: OrderShippingRecord; error?: string }
      | null;

    if (json?.shipping) return json.shipping;

    return {
      provider: "shiprocket",
      status: "failed",
      createdAt: new Date().toISOString(),
      error: json?.error ?? `Shiprocket request failed (${res.status})`,
    };
  } catch (e) {
    return {
      provider: "shiprocket",
      status: "failed",
      createdAt: new Date().toISOString(),
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
