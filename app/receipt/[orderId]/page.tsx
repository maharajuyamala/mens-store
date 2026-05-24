import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAdminFirestore } from "@/lib/server/firebase-admin";
import { verifyReceiptToken } from "@/lib/receipts/sign";
import { ReceiptView, type ReceiptData } from "./ReceiptView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Receipt",
  robots: { index: false, follow: false },
};

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Server-rendered, token-gated receipt.
 *
 *   GET /receipt/<orderId>?exp=<unixMs>&t=<HMAC>
 *
 * Renders live from the order doc on every visit — nothing is cached, no
 * bill image/PDF is stored. The token is HMAC-SHA256(orderId.exp) so the
 * link can't be tampered with and naturally stops working once exp passes.
 */
export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orderId } = await params;
  const sp = await searchParams;
  const exp = typeof sp.exp === "string" ? sp.exp : null;
  const token = typeof sp.t === "string" ? sp.t : null;

  if (!orderId || !/^[A-Za-z0-9_-]{4,}$/.test(orderId)) notFound();

  const verdict = verifyReceiptToken(orderId, exp, token);
  if (!verdict.ok) {
    return <ReceiptExpired reason={verdict.reason} />;
  }

  const db = getAdminFirestore();
  if (!db) {
    return (
      <ReceiptError
        title="Receipts temporarily unavailable"
        message="The receipt service is not configured. Please contact the store."
      />
    );
  }

  const snap = await db.collection("orders").doc(orderId).get();
  if (!snap.exists) notFound();
  const raw = snap.data() as Record<string, unknown>;

  const data = normalizeReceipt(orderId, raw, Number(exp));
  return <ReceiptView data={data} />;
}

function toDate(v: unknown): Date | null {
  if (
    v &&
    typeof v === "object" &&
    "toDate" in v &&
    typeof (v as { toDate: () => Date }).toDate === "function"
  ) {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (typeof v === "number") return new Date(v);
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function normalizeReceipt(
  orderId: string,
  d: Record<string, unknown>,
  expMs: number
): ReceiptData {
  const addr = (d.shippingAddress ?? {}) as Record<string, unknown>;
  const p = (d.pricing ?? {}) as Record<string, unknown>;
  const items = Array.isArray(d.items) ? d.items : [];
  const created = toDate(d.createdAt);
  return {
    orderId,
    orderNumber:
      typeof d.orderNumber === "string" ? d.orderNumber : orderId.slice(0, 8),
    createdAtIso: created ? created.toISOString() : null,
    paymentMethod:
      typeof d.paymentMethod === "string" ? d.paymentMethod : "cod",
    paymentStatus:
      typeof d.paymentStatus === "string" ? d.paymentStatus : null,
    saleChannel:
      typeof d.saleChannel === "string" ? d.saleChannel : null,
    customer: {
      name: typeof addr.fullName === "string" ? addr.fullName : null,
      email: typeof addr.email === "string" ? addr.email : null,
      phone: typeof addr.phone === "string" ? addr.phone : null,
      line1: typeof addr.line1 === "string" ? addr.line1 : null,
      line2: typeof addr.line2 === "string" ? addr.line2 : null,
      city: typeof addr.city === "string" ? addr.city : null,
      state: typeof addr.state === "string" ? addr.state : null,
      pincode: typeof addr.pincode === "string" ? addr.pincode : null,
    },
    items: items.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        name: typeof r.name === "string" ? r.name : "Item",
        quantity:
          typeof r.quantity === "number"
            ? r.quantity
            : Number(r.quantity) || 0,
        price:
          typeof r.price === "number" ? r.price : Number(r.price) || 0,
        size: typeof r.size === "string" ? r.size : null,
        color: typeof r.color === "string" ? r.color : null,
      };
    }),
    pricing: {
      subtotal: Number(p.subtotal) || 0,
      discount: Number(p.discount) || 0,
      shipping: Number(p.shipping) || 0,
      total: Number(p.total) || 0,
      advancePaid:
        p.advancePaid != null && !Number.isNaN(Number(p.advancePaid))
          ? Number(p.advancePaid)
          : null,
      balanceDue:
        p.balanceDue != null && !Number.isNaN(Number(p.balanceDue))
          ? Number(p.balanceDue)
          : null,
    },
    expiresAtIso: new Date(expMs).toISOString(),
  };
}

function ReceiptExpired({
  reason,
}: {
  reason: "missing" | "expired" | "invalid";
}) {
  const title =
    reason === "expired" ? "Receipt link expired" : "Receipt link invalid";
  const message =
    reason === "expired"
      ? "This receipt link is older than 30 days. Ask the store for a fresh link if you still need a copy."
      : "We couldn't verify this receipt link. Please double-check the URL.";
  return <ReceiptError title={title} message={message} />;
}

function ReceiptError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
