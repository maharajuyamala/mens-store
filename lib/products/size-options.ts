/**
 * Department-aware size palettes for the admin product forms.
 *
 *  - Kids                        → age brackets, regardless of garment type.
 *  - Men/Women + bottom-wear     → numeric waist sizes (inches).
 *  - Everything else             → alpha sizes XS–6XL.
 *
 * The returned strings are the exact values stored on the product doc
 * (`size: [{ "32": 5 }]` / `sizes: ["1-2Y"]`), so they double as display
 * labels in the cart, invoice, Shiprocket payload, etc. Keep them short.
 */

import type { ProductAudience } from "@/lib/products/schema";

/** Tops / shirts / jackets / formal / casual — alpha sizing up to 6XL. */
export const TOP_SIZES = [
  "XS",
  "S",
  "M",
  "L",
  "XL",
  "XXL",
  "3XL",
  "4XL",
  "5XL",
  "6XL",
] as const;

/** Bottoms / pants / trousers — waist in inches. */
export const BOTTOM_SIZES = [
  "26",
  "28",
  "30",
  "32",
  "34",
  "36",
  "38",
  "40",
] as const;

/** Age brackets for kidswear. Months for infants, years thereafter. */
export const KIDS_SIZES = [
  "0-6M",
  "6-12M",
  "1-2Y",
  "2-3Y",
  "3-4Y",
  "4-5Y",
  "5-6Y",
  "6-7Y",
  "7-8Y",
  "8-9Y",
  "9-10Y",
  "10-11Y",
  "11-12Y",
  "12-13Y",
  "13-14Y",
  "14-15Y",
] as const;

export type SizeGroup = "alpha" | "numeric" | "kids";

const BOTTOM_HINTS = new Set([
  "pants",
  "pant",
  "bottom",
  "bottoms",
  "trousers",
  "trouser",
  "jeans",
  "shorts",
  "joggers",
  "chinos",
]);

/**
 * Decide which size palette applies. `hints` can be the category (`"pants"`),
 * style tags (`["pants","casual"]`), or any free-form string from the doc.
 */
export function inferSizeGroup(
  audience: ProductAudience,
  hints: ReadonlyArray<string> | string | undefined
): SizeGroup {
  if (audience === "kids") return "kids";
  const arr =
    typeof hints === "string"
      ? [hints]
      : Array.isArray(hints)
        ? hints
        : [];
  if (arr.some((h) => BOTTOM_HINTS.has(h.toLowerCase().trim()))) {
    return "numeric";
  }
  return "alpha";
}

/** Convenience: directly fetch the size list to show in a form. */
export function getSizeOptions(
  audience: ProductAudience,
  hints: ReadonlyArray<string> | string | undefined
): readonly string[] {
  const group = inferSizeGroup(audience, hints);
  if (group === "kids") return KIDS_SIZES;
  if (group === "numeric") return BOTTOM_SIZES;
  return TOP_SIZES;
}

/** Friendly display label (e.g. `"1-2 years"`). The stored value stays compact. */
export function formatSizeLabel(size: string): string {
  const trimmed = size.trim();
  if (/^\d+-\d+M$/i.test(trimmed)) {
    return trimmed.replace(/M$/i, " months").replace("-", "–");
  }
  if (/^\d+-\d+Y$/i.test(trimmed)) {
    return trimmed.replace(/Y$/i, " years").replace("-", "–");
  }
  return trimmed;
}
