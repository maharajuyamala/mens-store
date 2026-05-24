/**
 * HMAC signing for public receipt links.
 *
 * Receipt URLs are shaped like:
 *   /receipt/<orderId>?exp=<unixMs>&t=<base64url HMAC>
 *
 * The signature ties together (orderId, exp) so links can't be tampered with
 * to extend their lifetime or repointed to a different order. We deliberately
 * keep the secret server-only and never write the bill HTML/PDF anywhere —
 * the receipt is rendered live from the order doc on each visit.
 *
 * RECEIPT_SIGNING_KEY: any high-entropy string (32+ chars). We fall back to
 * the Firebase service-account `private_key` so the link survives Vercel
 * cold starts without extra config. Prefer setting it explicitly in
 * production so rotating it can revoke all outstanding links in one go.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const RECEIPT_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function resolveSecret(): string {
  const direct = process.env.RECEIPT_SIGNING_KEY?.trim();
  if (direct && direct.length >= 16) return direct;

  // Fallback so receipts keep working in environments that only have the
  // service-account configured. The private_key has plenty of entropy and is
  // already server-only.
  try {
    const sa = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (sa) {
      const json = JSON.parse(sa) as { private_key?: string };
      if (json.private_key && json.private_key.length >= 32) {
        return `fbk:${json.private_key}`;
      }
    }
  } catch {
    /* JSON parse failed — fall through */
  }

  // Last-resort fallback only. Logging here is intentional: missing
  // RECEIPT_SIGNING_KEY in prod is a noisy misconfiguration.
  console.warn(
    "[receipts/sign] No RECEIPT_SIGNING_KEY and no Firebase service account; using insecure fallback. Set RECEIPT_SIGNING_KEY."
  );
  return "secondskin-insecure-fallback-receipt-key";
}

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

function sign(orderId: string, expMs: number): string {
  const h = createHmac("sha256", resolveSecret());
  h.update(`${orderId}.${expMs}`);
  return base64Url(h.digest());
}

/** Build the absolute path + query for a receipt link. */
export function buildReceiptPath(
  orderId: string,
  expMs: number = Date.now() + RECEIPT_LINK_TTL_MS
): string {
  const t = sign(orderId, expMs);
  const params = new URLSearchParams({ exp: String(expMs), t });
  return `/receipt/${encodeURIComponent(orderId)}?${params.toString()}`;
}

/** Absolute URL when an origin is available (server-side render or env). */
export function buildReceiptUrl(
  orderId: string,
  origin: string,
  expMs?: number
): string {
  const o = origin.replace(/\/$/, "");
  return `${o}${buildReceiptPath(orderId, expMs)}`;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "invalid" };

/** Verify (token, exp) for a given orderId. */
export function verifyReceiptToken(
  orderId: string,
  expRaw: string | null | undefined,
  tokenRaw: string | null | undefined,
  now: number = Date.now()
): VerifyResult {
  if (!expRaw || !tokenRaw) return { ok: false, reason: "missing" };
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= 0) return { ok: false, reason: "invalid" };
  if (exp < now) return { ok: false, reason: "expired" };

  const expected = sign(orderId, exp);
  let provided: Buffer;
  try {
    provided = fromBase64Url(tokenRaw);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  const expectedBuf = fromBase64Url(expected);
  if (provided.length !== expectedBuf.length) {
    return { ok: false, reason: "invalid" };
  }
  return timingSafeEqual(provided, expectedBuf)
    ? { ok: true }
    : { ok: false, reason: "invalid" };
}
