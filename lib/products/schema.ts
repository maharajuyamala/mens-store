import { z } from "zod";

export const PRODUCT_CATEGORIES = [
  "shirts",
  "pants",
  "jackets",
  "accessories",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Department for Explore / shop-by-audience (stored as `audience` on products). */
export const PRODUCT_AUDIENCES = ["men", "women", "kids"] as const;

export type ProductAudience = (typeof PRODUCT_AUDIENCES)[number];

/**
 * Historical alpha-only catalogue. The form now also accepts numeric (waist)
 * sizes for bottoms and age brackets for kidswear — see `lib/products/size-options.ts`.
 * Kept here for any legacy import-sites that still want the alpha shortlist.
 */
export const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export type ProductSize = string;

export const productFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string(),
  category: z.enum(PRODUCT_CATEGORIES),
  audience: z.enum(PRODUCT_AUDIENCES),
  price: z.coerce.number().positive("Price must be greater than 0"),
  compareAtPrice: z.string().optional(),
  stock: z.coerce.number().int().min(0, "Stock cannot be negative"),
  sizes: z
    .array(z.string().min(1).max(16))
    .min(1, "Select at least one size"),
  colors: z.array(z.string()),
});

export type ProductFormValues = z.infer<typeof productFormSchema>;

export type ProductStatus = "in_stock" | "low_stock" | "out_of_stock";

/** 0 → out, 1–5 → low, &gt;5 → in stock */
export function computeProductStatus(stock: number): ProductStatus {
  if (stock <= 0) return "out_of_stock";
  if (stock <= 5) return "low_stock";
  return "in_stock";
}
