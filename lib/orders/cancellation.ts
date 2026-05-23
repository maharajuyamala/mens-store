import {
  addDoc,
  collection,
  collectionGroup,
  getDocs,
  query,
  serverTimestamp,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getDb } from "@/app/firebase";

export type CancellationRequest = {
  id: string;
  orderId: string;
  userId: string;
  reason: string;
  status: "pending" | "fulfilled" | "rejected";
  createdAt: Date | null;
};

export async function requestOrderCancellation(input: {
  orderId: string;
  userId: string;
  reason: string;
}): Promise<void> {
  const ref = collection(
    getDb(),
    "orders",
    input.orderId,
    "cancellationRequests"
  );
  await addDoc(ref, {
    userId: input.userId,
    orderId: input.orderId,
    reason: input.reason.slice(0, 500),
    status: "pending" as const,
    createdAt: serverTimestamp(),
  });
}

function toDate(v: unknown): Date | null {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

function parseRequest(
  id: string,
  orderId: string,
  data: DocumentData
): CancellationRequest {
  return {
    id,
    orderId,
    userId: typeof data.userId === "string" ? data.userId : "",
    reason: typeof data.reason === "string" ? data.reason : "",
    status:
      data.status === "fulfilled" || data.status === "rejected"
        ? data.status
        : "pending",
    createdAt: toDate(data.createdAt),
  };
}

/** Admin: list all pending cancellation requests across all orders. */
export async function fetchPendingCancellationRequests(): Promise<
  CancellationRequest[]
> {
  const snap = await getDocs(
    query(
      collectionGroup(getDb(), "cancellationRequests"),
      where("status", "==", "pending")
    )
  );
  const out: CancellationRequest[] = [];
  for (const d of snap.docs) {
    const orderId = d.ref.parent.parent?.id ?? "";
    out.push(parseRequest(d.id, orderId, d.data()));
  }
  return out.sort((a, b) => {
    const ad = a.createdAt?.getTime() ?? 0;
    const bd = b.createdAt?.getTime() ?? 0;
    return ad - bd;
  });
}
