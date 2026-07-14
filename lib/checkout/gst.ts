/**
 * Indian apparel GST slabs (CGST+SGST combined, effective July 2022):
 *  - Per-piece price < ₹1000 → 5%
 *  - Per-piece price ≥ ₹1000 → 12%
 *
 * Our catalog prices are treated as tax-inclusive (MRP-style). This helper
 * splits an inclusive line into base + tax without changing the total the
 * customer sees. Shipping charges are also inclusive of 18% GST per the
 * courier's GSTIN.
 */
export const GST_SLAB_THRESHOLD_INR = 1000;
export const GST_RATE_LOW = 0.05;
export const GST_RATE_HIGH = 0.12;
export const GST_RATE_SHIPPING = 0.18;

/** Round to paise. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function gstRateForPrice(pricePerPiece: number): number {
  return pricePerPiece >= GST_SLAB_THRESHOLD_INR ? GST_RATE_HIGH : GST_RATE_LOW;
}

/** Extract the GST portion embedded in a tax-inclusive amount. */
export function extractGst(inclusive: number, rate: number): number {
  if (inclusive <= 0 || rate <= 0) return 0;
  return r2(inclusive - inclusive / (1 + rate));
}

export type GstBreakdown = {
  /** GST embedded in the merchandise (post-discount). */
  merchandiseGst: number;
  /** GST embedded in the shipping charge. */
  shippingGst: number;
  /** Merchandise + shipping GST. */
  totalGst: number;
  /** Effective merchandise rate used (weighted if lines mix slabs). */
  effectiveRate: number;
};

export type MerchLine = {
  price: number;
  quantity: number;
};

/**
 * Compute GST embedded in a set of merchandise lines + shipping. The discount
 * is prorated across lines (each line's GST is reduced proportionally), which
 * matches how invoicing systems handle discounts on tax-inclusive prices.
 */
export function computeGstBreakdown(
  lines: MerchLine[],
  discount: number,
  shipping: number
): GstBreakdown {
  const subtotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const discountClamped = Math.min(Math.max(0, discount), subtotal);
  const discountedSubtotal = subtotal - discountClamped;
  const discountRatio =
    subtotal > 0 ? discountedSubtotal / subtotal : 0;

  let merchandiseGst = 0;
  for (const line of lines) {
    const rate = gstRateForPrice(line.price);
    const lineInclusive = line.price * line.quantity * discountRatio;
    merchandiseGst += extractGst(lineInclusive, rate);
  }
  merchandiseGst = r2(merchandiseGst);

  const shippingGst = extractGst(shipping, GST_RATE_SHIPPING);
  const totalGst = r2(merchandiseGst + shippingGst);

  const effectiveRate =
    discountedSubtotal > 0
      ? r2((merchandiseGst / (discountedSubtotal - merchandiseGst)) * 100) / 100
      : 0;

  return { merchandiseGst, shippingGst, totalGst, effectiveRate };
}
