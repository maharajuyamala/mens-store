export type ShiprocketCreateOrderResponse = {
  order_id: number;
  shipment_id: number;
  status: string;
  status_code: number;
  onboarding_completed_now: number;
  awb_code?: string | null;
  courier_company_id?: number | null;
  courier_name?: string | null;
};

export type ShiprocketLoginResponse = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  company_id: number;
  token: string;
};

export type ShiprocketPaymentMethod = "Prepaid" | "COD";

export type ShiprocketOrderItem = {
  name: string;
  sku: string;
  units: number;
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: number | string;
};

export type ShiprocketAdhocOrderPayload = {
  order_id: string;
  order_date: string;
  pickup_location: string;
  channel_id?: string;
  comment?: string;
  billing_customer_name: string;
  billing_last_name: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: string;
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_state?: string;
  shipping_country?: string;
  shipping_email?: string;
  shipping_phone?: string;
  order_items: ShiprocketOrderItem[];
  payment_method: ShiprocketPaymentMethod;
  shipping_charges?: number;
  giftwrap_charges?: number;
  transaction_charges?: number;
  total_discount?: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
};

/** What we persist on the Firestore order doc under `shipping`. */
export type OrderShippingRecord = {
  provider: "shiprocket";
  status: "created" | "failed";
  shiprocketOrderId?: number;
  shipmentId?: number;
  awbCode?: string | null;
  courierName?: string | null;
  createdAt: string;
  error?: string;
};
