import "server-only";

export type EmailOrderLine = {
  name: string;
  quantity: number;
  price: number;
  size?: string;
};

export type EmailOrderSummary = {
  orderNumber: string;
  customerName: string;
  items: EmailOrderLine[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  /** Amount already collected online (Razorpay). Defaults to `total` for online, 0 for COD. */
  advancePaid?: number;
  /** Remaining amount the courier collects on delivery (COD only). Defaults to 0. */
  balanceDue?: number;
  paymentMethod: "cod" | "online" | string;
  trackingUrl?: string;
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#1f2937;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
        <tr><td style="background:#0f172a;padding:20px 24px;">
          <p style="margin:0;font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.01em;">SecondSkin</p>
        </td></tr>
        <tr><td style="padding:28px 24px 32px 24px;">${bodyHtml}</td></tr>
        <tr><td style="background:#f8fafc;padding:18px 24px;text-align:center;color:#64748b;font-size:12px;">
          Need help? Reply to this email and we'll get back to you.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function itemsTable(items: EmailOrderLine[]): string {
  const rows = items
    .map(
      (i) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">
          ${escapeHtml(i.name)}${i.size ? ` <span style="color:#64748b">· ${escapeHtml(i.size)}</span>` : ""}
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${i.quantity}</td>
        <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;">${escapeHtml(inr.format(i.price * i.quantity))}</td>
      </tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">
    <thead><tr>
      <th align="left" style="padding:8px 0;color:#64748b;font-weight:500;border-bottom:1px solid #e5e7eb;">Item</th>
      <th align="right" style="padding:8px 0;color:#64748b;font-weight:500;border-bottom:1px solid #e5e7eb;">Qty</th>
      <th align="right" style="padding:8px 0;color:#64748b;font-weight:500;border-bottom:1px solid #e5e7eb;">Amount</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function totalsBlock(o: EmailOrderSummary): string {
  const balance = Number(o.balanceDue ?? 0);
  const advance = Number(o.advancePaid ?? 0);
  const splitRows =
    o.paymentMethod === "cod" && balance > 0
      ? `<tr><td style="color:#64748b;padding-top:8px;">Advance paid online</td>
          <td align="right" style="padding-top:8px;">${escapeHtml(inr.format(advance))}</td></tr>
        <tr><td style="color:#0f172a;font-weight:600;">Balance due on delivery</td>
          <td align="right" style="color:#ea580c;font-weight:600;">${escapeHtml(inr.format(balance))}</td></tr>`
      : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;margin-top:16px;">
    <tr><td style="color:#64748b;">Subtotal</td><td align="right">${escapeHtml(inr.format(o.subtotal))}</td></tr>
    ${o.discount > 0 ? `<tr><td style="color:#64748b;">Discount</td><td align="right" style="color:#059669;">−${escapeHtml(inr.format(o.discount))}</td></tr>` : ""}
    <tr><td style="color:#64748b;">Shipping</td><td align="right">${o.shipping === 0 ? "Free" : escapeHtml(inr.format(o.shipping))}</td></tr>
    <tr><td style="padding-top:8px;border-top:1px solid #e5e7eb;font-weight:600;">Total</td>
        <td align="right" style="padding-top:8px;border-top:1px solid #e5e7eb;font-weight:600;color:#ea580c;">${escapeHtml(inr.format(o.total))}</td></tr>
    ${splitRows}
  </table>`;
}

export function renderOrderConfirmationEmail(o: EmailOrderSummary): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order ${o.orderNumber} confirmed — SecondSkin`;
  const balance = Number(o.balanceDue ?? 0);
  const advance = Number(o.advancePaid ?? 0);
  const paymentNote =
    o.paymentMethod === "cod"
      ? balance > 0
        ? `<p style="margin:0 0 8px 0;color:#475569;">Payment: Cash on delivery — ${escapeHtml(inr.format(advance))} paid online, ${escapeHtml(inr.format(balance))} due on delivery.</p>`
        : `<p style="margin:0 0 8px 0;color:#475569;">Payment: Cash on delivery</p>`
      : `<p style="margin:0 0 8px 0;color:#475569;">Payment: Paid online — thank you!</p>`;
  const body = `
    <h1 style="margin:0 0 8px 0;font-size:22px;letter-spacing:-0.01em;">Thanks for your order, ${escapeHtml(o.customerName.split(/\s+/)[0] ?? "friend")}!</h1>
    <p style="margin:0 0 16px 0;color:#475569;">Order <span style="font-family:monospace;color:#0f172a;font-weight:600;">${escapeHtml(o.orderNumber)}</span> is confirmed. We'll email you again when it ships.</p>
    ${paymentNote}
    <div style="margin:20px 0;">${itemsTable(o.items)}</div>
    ${totalsBlock(o)}
  `;
  const text = [
    `Order ${o.orderNumber} confirmed.`,
    ...o.items.map((i) => `${i.name}${i.size ? ` (${i.size})` : ""} × ${i.quantity}`),
    `Total: ${inr.format(o.total)}`,
  ].join("\n");
  return { subject, html: shell(subject, body), text };
}

export function renderOrderStatusEmail(
  o: EmailOrderSummary,
  status: string
): { subject: string; html: string; text: string } {
  const label = status.charAt(0).toUpperCase() + status.slice(1);
  const subject = `Order ${o.orderNumber}: ${label} — SecondSkin`;
  const trackBlock = o.trackingUrl
    ? `<p style="margin:0 0 16px 0;"><a href="${escapeHtml(o.trackingUrl)}" style="color:#ea580c;font-weight:600;">Track your package →</a></p>`
    : "";
  const body = `
    <h1 style="margin:0 0 8px 0;font-size:22px;letter-spacing:-0.01em;">Order ${escapeHtml(label)}</h1>
    <p style="margin:0 0 16px 0;color:#475569;">Your order <span style="font-family:monospace;color:#0f172a;font-weight:600;">${escapeHtml(o.orderNumber)}</span> is now <strong>${escapeHtml(status)}</strong>.</p>
    ${trackBlock}
    <div style="margin-top:24px;color:#64748b;font-size:13px;">Order total: ${escapeHtml(inr.format(o.total))}</div>
  `;
  const text = `Order ${o.orderNumber} is now ${status}.${o.trackingUrl ? `\nTrack: ${o.trackingUrl}` : ""}`;
  return { subject, html: shell(subject, body), text };
}
