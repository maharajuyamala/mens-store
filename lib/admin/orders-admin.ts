export const ORDER_STATUSES = [
  "pending",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StatusHistoryEntry = {
  status: OrderStatus;
  updatedAt: Date;
  updatedBy: string;
};

export type OrderPricing = {
  subtotal?: number;
  discount?: number;
  shipping?: number;
  gst?: number;
  total?: number;
  couponCode?: string | null;
};

export type OrderLine = {
  productId?: string;
  name: string;
  image?: string;
  price?: number;
  size?: string;
  color?: string;
  quantity: number;
};

export type ShippingAddress = {
  fullName?: string;
  email?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

export type AdminOrder = {
  id: string;
  orderNumber: string;
  createdAt: Date | null;
  status: OrderStatus;
  paymentMethod: string;
  userId: string;
  items: OrderLine[];
  shippingAddress: ShippingAddress;
  pricing: OrderPricing;
  statusHistory: StatusHistoryEntry[];
};

function toDate(v: unknown): Date | null {
  if (v && typeof v === "object" && "toDate" in v && typeof (v as { toDate: () => Date }).toDate === "function") {
    try {
      return (v as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }
  if (v && typeof v === "object" && "seconds" in v) {
    const s = (v as { seconds: number }).seconds;
    return typeof s === "number" ? new Date(s * 1000) : null;
  }
  return null;
}

function parseStatus(s: unknown): OrderStatus {
  const x = typeof s === "string" ? s.toLowerCase() : "";
  if ((ORDER_STATUSES as readonly string[]).includes(x)) return x as OrderStatus;
  return "pending";
}

function parseStatusHistory(raw: unknown): StatusHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: StatusHistoryEntry[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const status = parseStatus(r.status);
    const updatedAt = toDate(r.updatedAt);
    const updatedBy = typeof r.updatedBy === "string" ? r.updatedBy : "—";
    if (updatedAt) out.push({ status, updatedAt, updatedBy });
  }
  return out.sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
}

function parseItems(raw: unknown): OrderLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const r = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
    return {
      productId: typeof r.productId === "string" ? r.productId : undefined,
      name: typeof r.name === "string" ? r.name : "Item",
      image: typeof r.image === "string" ? r.image : undefined,
      price: typeof r.price === "number" ? r.price : Number(r.price) || undefined,
      size: typeof r.size === "string" ? r.size : undefined,
      color: typeof r.color === "string" ? r.color : undefined,
      quantity:
        typeof r.quantity === "number" && !Number.isNaN(r.quantity)
          ? r.quantity
          : Number(r.quantity) || 0,
    };
  });
}

function parseShipping(raw: unknown): ShippingAddress {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  return {
    fullName: typeof r.fullName === "string" ? r.fullName : undefined,
    email: typeof r.email === "string" ? r.email : undefined,
    phone: typeof r.phone === "string" ? r.phone : undefined,
    line1: typeof r.line1 === "string" ? r.line1 : undefined,
    line2: typeof r.line2 === "string" ? r.line2 : undefined,
    city: typeof r.city === "string" ? r.city : undefined,
    state: typeof r.state === "string" ? r.state : undefined,
    pincode: typeof r.pincode === "string" ? r.pincode : undefined,
  };
}

function parsePricing(raw: unknown): OrderPricing {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const num = (k: string) =>
    typeof r[k] === "number" && !Number.isNaN(r[k] as number)
      ? (r[k] as number)
      : Number(r[k]);
  return {
    subtotal: num("subtotal"),
    discount: num("discount"),
    shipping: num("shipping"),
    gst: num("gst"),
    total: num("total"),
    couponCode:
      r.couponCode === null || typeof r.couponCode === "string"
        ? (r.couponCode as string | null)
        : undefined,
  };
}

export function docToAdminOrder(id: string, data: Record<string, unknown>): AdminOrder {
  return {
    id,
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : id.slice(0, 8),
    createdAt: toDate(data.createdAt),
    status: parseStatus(data.status),
    paymentMethod:
      typeof data.paymentMethod === "string" ? data.paymentMethod : "—",
    userId: typeof data.userId === "string" ? data.userId : "guest",
    items: parseItems(data.items),
    shippingAddress: parseShipping(data.shippingAddress),
    pricing: parsePricing(data.pricing),
    statusHistory: parseStatusHistory(data.statusHistory),
  };
}

/** Valid choices for the status dropdown from the current status. */
export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  if (current === "cancelled") return ["cancelled"];
  if (current === "delivered") return ["delivered", "cancelled"];
  const map: Record<OrderStatus, OrderStatus[]> = {
    pending: ["pending", "processing", "cancelled"],
    processing: ["processing", "shipped", "cancelled"],
    shipped: ["shipped", "delivered", "cancelled"],
    delivered: ["delivered", "cancelled"],
    cancelled: ["cancelled"],
  };
  return map[current] ?? [current];
}

export function buildTimeline(
  order: AdminOrder
): { label: string; detail: string; at: Date }[] {
  const rows: { label: string; detail: string; at: Date }[] = [];
  const placed = order.createdAt ?? new Date(0);
  rows.push({
    label: "Order placed",
    detail: `Status: pending`,
    at: placed,
  });
  for (const h of order.statusHistory) {
    rows.push({
      label: `Status: ${h.status}`,
      detail: `Updated by ${h.updatedBy}`,
      at: h.updatedAt,
    });
  }
  rows.sort((a, b) => a.at.getTime() - b.at.getTime());
  return rows;
}

function csvEscape(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ordersToCsv(orders: AdminOrder[]): string {
  const headers = [
    "Order number",
    "Date (ISO)",
    "Customer",
    "Email",
    "Phone",
    "Line items",
    "Units",
    "Subtotal",
    "Discount",
    "Shipping",
    "GST",
    "Total",
    "Payment",
    "Status",
    "User id",
  ];
  const lines = [headers.join(",")];
  for (const o of orders) {
    const units = o.items.reduce((n, i) => n + i.quantity, 0);
    const p = o.pricing;
    const row = [
      o.orderNumber,
      o.createdAt ? o.createdAt.toISOString() : "",
      o.shippingAddress.fullName ?? "",
      o.shippingAddress.email ?? "",
      o.shippingAddress.phone ?? "",
      String(o.items.length),
      String(units),
      p.subtotal != null && !Number.isNaN(p.subtotal) ? String(p.subtotal) : "",
      p.discount != null && !Number.isNaN(p.discount) ? String(p.discount) : "",
      p.shipping != null && !Number.isNaN(p.shipping) ? String(p.shipping) : "",
      p.gst != null && !Number.isNaN(p.gst) ? String(p.gst) : "",
      p.total != null && !Number.isNaN(p.total) ? String(p.total) : "",
      o.paymentMethod,
      o.status,
      o.userId,
    ].map((c) => csvEscape(String(c)));
    lines.push(row.join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob(["\ufeff", content], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
