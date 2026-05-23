import {
  collection,
  documentId,
  getDocs,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/app/firebase";
import { getSizesMap } from "@/lib/admin/inventory";
import { isListedProduct } from "@/lib/explore/types";
import type { CartItem } from "@/store/cartStore";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function availableForLine(data: DocumentData, line: CartItem): number {
  const map = getSizesMap(data as Record<string, unknown>);
  if (line.size && Object.keys(map).length > 0) {
    const v = map[line.size];
    return typeof v === "number" ? Math.max(0, Math.floor(v)) : 0;
  }
  const stock = data.stock;
  if (typeof stock === "number" && !Number.isNaN(stock)) {
    return Math.max(0, Math.floor(stock));
  }
  if (typeof stock === "string" && stock.trim() !== "") {
    const n = Number(stock);
    if (!Number.isNaN(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

export type CartRevalidationChange =
  | { type: "removed"; id: string; name: string; reason: "unlisted" | "missing" | "out_of_stock" }
  | { type: "clamped"; id: string; name: string; from: number; to: number };

export type CartRevalidationResult = {
  changes: CartRevalidationChange[];
  nextItems: CartItem[];
};

/**
 * Compares each cart line against current Firestore product state. Items that
 * have been archived/deleted are removed; over-quantity lines are clamped to
 * what's available. Pure — caller is responsible for setting the cart store.
 */
export async function revalidateCart(
  items: CartItem[]
): Promise<CartRevalidationResult> {
  if (items.length === 0) return { changes: [], nextItems: items };

  const ids = [...new Set(items.map((i) => i.productId).filter(Boolean))];
  const productMap = new Map<string, DocumentData>();
  const db = getDb();

  for (const batch of chunk(ids, 10)) {
    const snap = await getDocs(
      query(collection(db, "products"), where(documentId(), "in", batch))
    );
    for (const d of snap.docs) {
      productMap.set(d.id, d.data());
    }
  }

  const changes: CartRevalidationChange[] = [];
  const nextItems: CartItem[] = [];

  for (const item of items) {
    const data = productMap.get(item.productId);
    if (!data) {
      changes.push({ type: "removed", id: item.id, name: item.name, reason: "missing" });
      continue;
    }
    if (!isListedProduct(data)) {
      changes.push({ type: "removed", id: item.id, name: item.name, reason: "unlisted" });
      continue;
    }
    const available = availableForLine(data, item);
    if (available <= 0) {
      changes.push({ type: "removed", id: item.id, name: item.name, reason: "out_of_stock" });
      continue;
    }
    if (item.quantity > available) {
      changes.push({
        type: "clamped",
        id: item.id,
        name: item.name,
        from: item.quantity,
        to: available,
      });
      nextItems.push({ ...item, quantity: available });
      continue;
    }
    nextItems.push(item);
  }

  return { changes, nextItems };
}
