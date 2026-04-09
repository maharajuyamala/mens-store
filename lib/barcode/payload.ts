/** Versioned QR payload so we can extend without breaking scanners. */
export type ProductBarcodePayloadV1 = {
  v: 1;
  p: string;
};

export function encodeProductQrPayload(productId: string): string {
  const payload: ProductBarcodePayloadV1 = { v: 1, p: productId };
  return JSON.stringify(payload);
}

/**
 * Resolve a Firestore product document id from scanned or pasted text.
 * Supports JSON payload, bare ids, or `mens:<id>` prefix.
 */
export function parseProductIdFromScan(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;

  if (t.startsWith("mens:")) {
    const id = t.slice(5).trim();
    return id.length >= 10 ? id : null;
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
      return id.length >= 10 ? id : null;
    }
  } catch {
    /* not JSON */
  }

  // Firestore auto-ids are 20 URL-safe chars; allow 10+ for forward compatibility
  if (/^[A-Za-z0-9_-]{10,}$/.test(t)) return t;

  return null;
}
