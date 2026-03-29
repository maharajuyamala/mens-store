"use client";

import {
  collection,
  documentId,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { getClientFirebase } from "@/app/firebase";
import {
  docToExploreProduct,
  isListedProduct,
  type ExploreProduct,
} from "@/lib/explore/types";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Preserves order of `ids`; skips missing or unlisted products. */
export async function fetchListedProductsByIds(
  ids: string[]
): Promise<ExploreProduct[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  const fb = getClientFirebase();
  if (!fb) return [];

  const map = new Map<string, ExploreProduct>();

  for (const batch of chunk(unique, 10)) {
    const qRef = query(
      collection(fb.db, "products"),
      where(documentId(), "in", batch)
    );
    const snap = await getDocs(qRef);
    for (const d of snap.docs) {
      const data = d.data();
      if (!isListedProduct(data)) continue;
      map.set(d.id, docToExploreProduct(d.id, data));
    }
  }

  return ids.map((id) => map.get(id)).filter((p): p is ExploreProduct => !!p);
}
