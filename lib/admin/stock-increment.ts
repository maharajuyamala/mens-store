import {
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { getDb } from "@/app/firebase";
import { getSizesMap, totalUnits } from "@/lib/admin/inventory";
import { computeProductStatus } from "@/lib/products/schema";

function parseTopLevelStock(raw: Record<string, unknown>): number {
  const v = raw.stock;
  if (typeof v === "number" && !Number.isNaN(v)) {
    return Math.max(0, Math.floor(v));
  }
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (!Number.isNaN(n)) return Math.max(0, Math.floor(n));
  }
  return 0;
}

/**
 * Admin-only: increase (or decrease) inventory. Uses per-size map when the
 * product has a sizes map; otherwise adjusts aggregate `stock`.
 */
export async function applyStockDelta(
  productId: string,
  delta: number,
  options?: { size?: string }
): Promise<void> {
  if (!Number.isFinite(delta) || delta === 0) return;

  const db = getDb();
  const ref = doc(db, "products", productId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error("Product not found");
    }
    const data = snap.data() as Record<string, unknown>;
    const map = { ...getSizesMap(data) };
    const hasMap = Object.keys(map).length > 0;
    const sizeKey = options?.size?.trim() ?? "";

    if (hasMap && sizeKey) {
      const cur = map[sizeKey] ?? 0;
      const next = cur + delta;
      if (next < 0) {
        throw new Error("Not enough stock for that size.");
      }
      map[sizeKey] = next;
      const stock = totalUnits(map);
      tx.update(ref, {
        sizes: map,
        stock,
        status: computeProductStatus(stock),
        updatedAt: serverTimestamp(),
      });
      return;
    }

    if (hasMap && !sizeKey) {
      throw new Error("Select a size for this product.");
    }

    const cur = parseTopLevelStock(data);
    const next = cur + delta;
    if (next < 0) {
      throw new Error("Not enough stock.");
    }
    tx.update(ref, {
      stock: next,
      status: computeProductStatus(next),
      updatedAt: serverTimestamp(),
    });
  });
}
