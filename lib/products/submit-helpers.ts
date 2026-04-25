import { deleteField, serverTimestamp } from "firebase/firestore";
import { computeProductStatus, type ProductFormValues } from "@/lib/products/schema";

export function parseCompareAtPrice(raw: string | undefined): number | undefined {
  const t = raw?.trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

export function buildNewProductData(values: ProductFormValues, imageUrls: string[]) {
  const compareAt = parseCompareAtPrice(values.compareAtPrice);
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category,
    audience: values.audience,
    price: values.price,
    ...(compareAt !== undefined ? { compareAtPrice: compareAt } : {}),
    stock: values.stock,
    sizes: values.sizes,
    colors: values.colors,
    images: imageUrls,
    active: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: computeProductStatus(values.stock),
  };
}

export function buildUpdateProductData(values: ProductFormValues, imageUrls: string[]) {
  const compareAt = parseCompareAtPrice(values.compareAtPrice);
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category,
    audience: values.audience,
    price: values.price,
    stock: values.stock,
    sizes: values.sizes,
    colors: values.colors,
    images: imageUrls,
    updatedAt: serverTimestamp(),
    status: computeProductStatus(values.stock),
    ...(compareAt !== undefined
      ? { compareAtPrice: compareAt }
      : { compareAtPrice: deleteField() }),
  };
}
