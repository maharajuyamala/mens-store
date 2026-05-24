import type { DeliveryFormValues } from "@/lib/checkout/deliverySchema";
import { computePricing } from "@/lib/checkout/pricing";
import { placeOrder, type PlacedOrder } from "@/lib/checkout/placeOrder";
import type { CartItem } from "@/store/cartStore";

/** Minimal valid address for Firestore rules + POS sales. */
export const POS_PLACEHOLDER_ADDRESS: DeliveryFormValues = {
  fullName: "In-store (POS)",
  email: "pos@instore.local",
  phone: "0000000000",
  line1: "Point of sale",
  line2: "",
  city: "Store",
  state: "IN",
  pincode: "000000",
};

/**
 * Compose a POS-grade shipping address. The phone is mandatory at the till
 * because it doubles as the customer identifier on the printed receipt and
 * for reprint links shared by SMS/WhatsApp.
 */
export function buildPosAddress(input: {
  customerName?: string | null;
  customerPhone: string;
}): DeliveryFormValues {
  const name = input.customerName?.trim();
  return {
    ...POS_PLACEHOLDER_ADDRESS,
    fullName: name && name.length > 0 ? name : POS_PLACEHOLDER_ADDRESS.fullName,
    phone: input.customerPhone.trim() || POS_PLACEHOLDER_ADDRESS.phone,
  };
}

export type PlacePosSaleInput = {
  userId: string;
  /** One or many cart items — the whole "bucket" the cashier rang up. */
  items: CartItem[];
  /** Optional customer contact captured at the mobile-number step. */
  customerName?: string | null;
  customerPhone?: string | null;
};

export async function placePosSale(
  input: PlacePosSaleInput
): Promise<PlacedOrder> {
  const { items, userId, customerName, customerPhone } = input;
  if (items.length === 0) {
    throw new Error("Cart is empty");
  }
  const address = customerPhone
    ? buildPosAddress({ customerName, customerPhone })
    : POS_PLACEHOLDER_ADDRESS;
  return placeOrder({
    items,
    shippingAddress: address,
    pricing: computePricing(items, 0),
    couponCode: null,
    paymentMethod: "cod",
    userId,
    saleChannel: "pos",
  });
}
