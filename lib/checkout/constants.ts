/** Single source of truth for shipping costs (INR). Shipping is free for all customers. */
export const FREE_SHIPPING_THRESHOLD_INR = 0;
export const STANDARD_SHIPPING_INR = 0;

/**
 * Advance amount (in INR) the customer pays online when choosing Cash on Delivery.
 * The remaining balance (`total - COD_ADVANCE_INR`) is collected by the courier.
 */
export const COD_ADVANCE_INR = 100;