import { cache } from "react";
import type { DocumentData } from "firebase/firestore";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  docToExploreProduct,
  isListedProduct,
  type ExploreProduct,
} from "@/lib/explore/types";
import { parseProductDetail, pickRelatedProducts } from "@/lib/product-detail";
import { getServerFirestore } from "@/lib/server/firebase-node";

export const fetchListedExploreProducts = cache(
  async (): Promise<ExploreProduct[]> => {
    const db = getServerFirestore();
    if (!db) return [];
    try {
      const snap = await getDocs(collection(db, "products"));
      const out: ExploreProduct[] = [];
      for (const d of snap.docs) {
        try {
          const data = d.data();
          if (!isListedProduct(data)) continue;
          out.push(docToExploreProduct(d.id, data));
        } catch (err) {
          console.error(
            "[fetchListedExploreProducts] skipped malformed doc",
            d.id,
            err
          );
        }
      }
      return out;
    } catch (err) {
      console.error("[fetchListedExploreProducts]", err);
      return [];
    }
  }
);

/** JSON-serializable Firestore payload for the PDP client (no functions). */
export type ProductPageData = {
  productData: Record<string, unknown> | null;
  related: ExploreProduct[];
};

function cloneDocData(data: DocumentData): Record<string, unknown> {
  return JSON.parse(JSON.stringify(data)) as Record<string, unknown>;
}

export const fetchProductPageData = cache(
  async (productId: string): Promise<ProductPageData> => {
    const db = getServerFirestore();
    if (!db) return { productData: null, related: [] };
    const ref = doc(db, "products", productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { productData: null, related: [] };
    const raw = snap.data();
    const parsed = parseProductDetail(productId, raw);
    if (!parsed) return { productData: null, related: [] };
    const allSnap = await getDocs(collection(db, "products"));
    const related = pickRelatedProducts(
      allSnap.docs,
      productId,
      parsed.category,
      4
    );
    return { productData: cloneDocData(raw), related };
  }
);

/** For generateMetadata (server-only; includes stockForSize). */
export async function parseProductForMetadata(productId: string) {
  const { productData } = await fetchProductPageData(productId);
  if (!productData) return null;
  return parseProductDetail(productId, productData as DocumentData);
}

export function firstListedProductImage(products: ExploreProduct[]): string | null {
  const p = products.find((x) => x.image?.trim());
  return p?.image ?? null;
}
