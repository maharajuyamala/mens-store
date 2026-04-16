/** Public site used in product QR deep links when no env is set (non-localhost). */
export const DEFAULT_PRODUCT_QR_ORIGIN = "https://secondskinmensworld.com";

/** Versioned JSON payload (legacy printed QRs only — never written to new QRs). */
export type ProductBarcodePayloadV1 = {
  v: 1;
  p: string;
};

function qrSiteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  if (fromEnv) return fromEnv;

  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    const localDev =
      h === "localhost" ||
      h === "127.0.0.1" ||
      h === "[::1]" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h);
    if (localDev) {
      return window.location.origin.replace(/\/$/, "");
    }
  }

  return DEFAULT_PRODUCT_QR_ORIGIN;
}

/**
 * HTTPS URL that opens Scan & stock with `?product=` (phone camera opens browser).
 * - `NEXT_PUBLIC_SITE_URL` wins when set at build time.
 * - On localhost, uses the current dev origin.
 * - Otherwise defaults to {@link DEFAULT_PRODUCT_QR_ORIGIN} so labels work without env.
 */
export function productScanStockUrl(productId: string): string {
  const base = qrSiteOrigin();
  const q = new URLSearchParams({ product: productId });
  return `${base}/admin/inventory/scan?${q.toString()}`;
}

/** String stored in product QR codes (deep link URL). */
export function encodeProductQrPayload(productId: string): string {
  return productScanStockUrl(productId);
}

const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function isValidProductId(id: string): boolean {
  return PRODUCT_ID_RE.test(id);
}

/**
 * Resolve a Firestore product document id from scanned or pasted text.
 * Supports Scan & stock URLs (`.../admin/inventory/scan?product=`), JSON payload,
 * bare ids, or `mens:<id>` prefix.
 */
export function parseProductIdFromScan(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  // https://secondskinmensworld.com/admin/inventory/scan?product=...
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const path = u.pathname.replace(/\/+$/, "") || "/";
      if (path.endsWith("/admin/inventory/scan")) {
        const id = u.searchParams.get("product")?.trim();
        if (id) {
          const decoded = decodeURIComponent(id);
          if (isValidProductId(decoded)) return decoded;
        }
      }
    } catch {
      /* invalid URL */
    }
  }

  if (t.startsWith("mens:")) {
    const id = t.slice(5).trim();
    return isValidProductId(id) ? id : null;
  }

  try {
    const parsed = JSON.parse(t) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      (parsed as ProductBarcodePayloadV1).v === 1 &&
      typeof (parsed as ProductBarcodePayloadV1).p === "string"
    ) {
      const id = (parsed as ProductBarcodePayloadV1).p.trim();
      return isValidProductId(id) ? id : null;
    }
  } catch {
    /* not JSON */
  }

  // Path-only deep link pasted without origin
  const pathMatch = t.match(/\/admin\/inventory\/scan\?([^#]+)/);
  if (pathMatch?.[1]) {
    try {
      const params = new URLSearchParams(pathMatch[1]);
      const id = params.get("product")?.trim();
      if (id) {
        const decoded = decodeURIComponent(id);
        if (isValidProductId(decoded)) return decoded;
      }
    } catch {
      /* */
    }
  }

  if (isValidProductId(t)) return t;

  return null;
}
