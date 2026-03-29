import type { Timestamp } from "firebase/firestore";

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function isTimestamp(x: unknown): x is Timestamp {
  return (
    typeof x === "object" &&
    x !== null &&
    "toDate" in x &&
    typeof (x as Timestamp).toDate === "function"
  );
}

/**
 * Sum `total` or `amount` on order docs whose `createdAt` is in the current calendar month.
 */
export function revenueThisMonth(
  docs: Array<{ data: () => Record<string, unknown> }>,
  now = new Date()
): number {
  const start = startOfMonth(now);
  let sum = 0;
  for (const d of docs) {
    const data = d.data();
    const created = data.createdAt;
    if (!isTimestamp(created)) continue;
    const t = created.toDate();
    if (t < start || t > now) continue;
    const raw = data.total ?? data.amount;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isNaN(n)) sum += n;
  }
  return Math.round(sum * 100) / 100;
}
