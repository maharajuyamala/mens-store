"use client";

import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import {
  collection,
  endAt,
  getDocs,
  limit,
  orderBy,
  query,
  startAt,
  where,
} from "firebase/firestore";
import { getClientFirebase } from "@/app/firebase";
import {
  docToExploreProduct,
  isListedProduct,
  type ExploreProduct,
} from "@/lib/explore/types";
import { isVariantCode, normalizeVariantCode } from "@/lib/products/variant-code";

function mergeProducts(
  into: Map<string, ExploreProduct>,
  docs: QueryDocumentSnapshot<DocumentData>[]
) {
  for (const d of docs) {
    const data = d.data();
    if (!isListedProduct(data)) continue;
    const p = docToExploreProduct(d.id, data);
    if (p.stockStatus === "out_of_stock") continue;
    into.set(d.id, p);
  }
}

/**
 * Firestore-backed search: `tags` array-contains (lowercase), name prefix range,
 * and a bounded recent-products scan for case-insensitive name/tag substring match.
 */
export async function searchListedProducts(
  raw: string
): Promise<ExploreProduct[]> {
  const term = raw.trim();
  if (term.length < 2) return [];

  try {
  const fb = getClientFirebase();
  if (!fb) return [];

  const db = fb.db;
  const lower = term.toLowerCase();
  const firstToken = lower.split(/\s+/).filter(Boolean)[0] ?? lower;
  const results = new Map<string, ExploreProduct>();

  const tagFull = query(
    collection(db, "products"),
    where("tags", "array-contains", lower),
    limit(40)
  );
  const tagToken =
    firstToken.length >= 2 && firstToken !== lower
      ? query(
          collection(db, "products"),
          where("tags", "array-contains", firstToken),
          limit(40)
        )
      : null;

  const namePrefix = query(
    collection(db, "products"),
    orderBy("name"),
    startAt(term),
    endAt(`${term}\uf8ff`),
    limit(40)
  );

  // Variant-code shortcut — when the typed term looks like a 5-char code,
  // also try an exact array-contains on `variantCodes`. Cheap query and
  // takes the customer straight to the matching product card.
  const normalizedCode = normalizeVariantCode(term);
  const codeQuery = isVariantCode(normalizedCode)
    ? query(
        collection(db, "products"),
        where("variantCodes", "array-contains", normalizedCode),
        limit(10)
      )
    : null;

  const snaps = await Promise.all([
    getDocs(tagFull),
    tagToken ? getDocs(tagToken) : Promise.resolve(null),
    getDocs(namePrefix).catch(() => null),
    codeQuery ? getDocs(codeQuery).catch(() => null) : Promise.resolve(null),
  ]);

  mergeProducts(results, snaps[0]!.docs);
  if (snaps[1]) {
    mergeProducts(results, snaps[1].docs);
  }
  if (snaps[2]) {
    mergeProducts(results, snaps[2].docs);
  }
  if (snaps[3]) {
    mergeProducts(results, snaps[3].docs);
  }

  if (results.size < 12) {
    const recentQ = query(
      collection(db, "products"),
      orderBy("createdAt", "desc"),
      limit(150)
    );
    try {
      const recentSnap = await getDocs(recentQ);
      for (const d of recentSnap.docs) {
        const data = d.data();
        if (!isListedProduct(data)) continue;
        const p = docToExploreProduct(d.id, data);
        if (p.stockStatus === "out_of_stock") continue;
        const nameOk = p.name.toLowerCase().includes(lower);
        const tagOk = p.tags.some(
          (t) => t.includes(lower) || lower.includes(t)
        );
        // Catches legacy docs that haven't been re-saved with a flat
        // `variantCodes` field yet — `docToExploreProduct` already
        // backfills the codes deterministically, so an `includes` check
        // works for both stored and computed values.
        const codeOk =
          normalizedCode.length >= 2 &&
          p.variantCodes.some((c) => c.includes(normalizedCode));
        if (nameOk || tagOk || codeOk) {
          results.set(d.id, p);
        }
      }
    } catch {
      /* missing createdAt index — skip fallback */
    }
  }

  const list = Array.from(results.values());
  list.sort((a, b) => {
    const an = a.name.toLowerCase().startsWith(lower) ? 0 : 1;
    const bn = b.name.toLowerCase().startsWith(lower) ? 0 : 1;
    if (an !== bn) return an - bn;
    return a.name.localeCompare(b.name);
  });
  return list.slice(0, 24);
  } catch {
    return [];
  }
}
