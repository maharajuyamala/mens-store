import { deliverySchema, type DeliveryFormValues } from "@/lib/checkout/deliverySchema";

const STORAGE_KEY = "mens-store:checkout:delivery:v1";

export function readSavedDelivery(): DeliveryFormValues | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const r = deliverySchema.safeParse(parsed);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function writeSavedDelivery(values: DeliveryFormValues): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
  } catch {
    // private mode / quota
  }
}
