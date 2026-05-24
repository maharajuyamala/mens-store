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
 * Result of decoding a scanned QR / barcode. New variant-aware QRs carry
 * `color` and `size`; legacy QRs only carry the product id and the cashier
 * picks color/size manually.
 */
export type ScanPayload = {
  productId: string;
  color?: string;
  size?: string;
};

/**
 * HTTPS URL that opens Scan & stock with `?product=…&color=…&size=…`.
 * - `NEXT_PUBLIC_SITE_URL` wins when set at build time.
 * - On localhost, uses the current dev origin.
 * - Otherwise defaults to {@link DEFAULT_PRODUCT_QR_ORIGIN} so labels work without env.
 *
 * When `color` / `size` are omitted the URL stays backward-compatible with
 * already-printed labels.
 */
export function productScanStockUrl(
  productId: string,
  variant?: { color?: string | null; size?: string | null }
): string {
  const base = qrSiteOrigin();
  const q = new URLSearchParams({ product: productId });
  const color = variant?.color?.trim();
  const size = variant?.size?.trim();
  if (color) q.set("color", color);
  if (size) q.set("size", size);
  return `${base}/admin/inventory/scan?${q.toString()}`;
}

/** String stored in product QR codes (deep link URL). */
export function encodeProductQrPayload(
  productId: string,
  variant?: { color?: string | null; size?: string | null }
): string {
  return productScanStockUrl(productId, variant);
}

const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{10,}$/;
// Size/color values are stored lowercase ("wine-red", "M", "32") — be permissive.
const VARIANT_VALUE_RE = /^[A-Za-z0-9_\- ]{1,32}$/;

function isValidProductId(id: string): boolean {
  return PRODUCT_ID_RE.test(id);
}

function sanitizeVariantValue(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (!v) return undefined;
  if (!VARIANT_VALUE_RE.test(v)) return undefined;
  return v;
}

/**
 * @deprecated Use {@link parseScanPayload} which also returns color/size.
 * Kept as a thin shim for older call sites.
 */
export function parseProductIdFromScan(raw: string): string | null {
  return parseScanPayload(raw)?.productId ?? null;
}

/**
 * Resolve a Firestore product document id (and optional color/size) from
 * scanned or pasted text. Supports Scan & stock URLs
 * (`.../admin/inventory/scan?product=&color=&size=`), JSON payload,
 * bare ids, or `mens:<id>` prefix.
 */
export function parseScanPayload(raw: string): ScanPayload | null {
  const t = raw.trim();
  if (!t) return null;

  // https://secondskinmensworld.com/admin/inventory/scan?product=…&color=…&size=…
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const path = u.pathname.replace(/\/+$/, "") || "/";
      if (path.endsWith("/admin/inventory/scan")) {
        const idRaw = u.searchParams.get("product")?.trim();
        if (idRaw) {
          const id = (() => {
            try {
              return decodeURIComponent(idRaw);
            } catch {
              return idRaw;
            }
          })();
          if (isValidProductId(id)) {
            return {
              productId: id,
              color: sanitizeVariantValue(u.searchParams.get("color")),
              size: sanitizeVariantValue(u.searchParams.get("size")),
            };
          }
        }
      }
    } catch {
      /* invalid URL */
    }
  }

  if (t.startsWith("mens:")) {
    const id = t.slice(5).trim();
    return isValidProductId(id) ? { productId: id } : null;
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
      return isValidProductId(id) ? { productId: id } : null;
    }
  } catch {
    /* not JSON */
  }

  // Path-only deep link pasted without origin
  const pathMatch = t.match(/\/admin\/inventory\/scan\?([^#]+)/);
  if (pathMatch?.[1]) {
    try {
      const params = new URLSearchParams(pathMatch[1]);
      const idRaw = params.get("product")?.trim();
      if (idRaw) {
        const id = (() => {
          try {
            return decodeURIComponent(idRaw);
          } catch {
            return idRaw;
          }
        })();
        if (isValidProductId(id)) {
          return {
            productId: id,
            color: sanitizeVariantValue(params.get("color")),
            size: sanitizeVariantValue(params.get("size")),
          };
        }
      }
    } catch {
      /* */
    }
  }

  if (isValidProductId(t)) return { productId: t };

  return null;
}
