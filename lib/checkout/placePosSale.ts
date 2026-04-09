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

export async function placePosSale(input: {
  userId: string;
  item: CartItem;
}): Promise<PlacedOrder> {
  const { item, userId } = input;
  return placeOrder({
    items: [item],
    shippingAddress: POS_PLACEHOLDER_ADDRESS,
    pricing: computePricing([item], 0),
    couponCode: null,
    paymentMethod: "cod",
    userId,
    saleChannel: "pos",
  });
}
