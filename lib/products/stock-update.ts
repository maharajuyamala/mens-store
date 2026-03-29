import { serverTimestamp } from "firebase/firestore";
import { computeProductStatus } from "@/lib/products/schema";

export function stockAndStatusPatch(stock: number) {
  const s = Math.max(0, Math.floor(stock));
  return {
    stock: s,
    status: computeProductStatus(s),
    updatedAt: serverTimestamp(),
  };
}
