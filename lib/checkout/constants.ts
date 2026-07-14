/**
 * Free-delivery threshold (INR). When the discounted subtotal is at or above
 * this value, shipping is waived — both on the client preview and on the
 * server-authoritative recompute. Below the threshold, the customer pays the
 * live Shiprocket rate.
 */
export const FREE_SHIPPING_THRESHOLD_INR = 1000;
/** Fallback shipping (INR) used only in previews before a real quote lands. */
export const STANDARD_SHIPPING_INR = 0;

/**
 * Advance amount (in INR) the customer pays online when choosing Cash on Delivery.
 * The remaining balance (`total - COD_ADVANCE_INR`) is collected by the courier.
 */
export const COD_ADVANCE_INR = 100;