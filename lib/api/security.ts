import { NextResponse } from "next/server";

/**
 * Lightweight in-memory rate limiter keyed by IP. Token bucket; resets after
 * the window expires. Not durable — survives only as long as the Node process.
 * Good enough as a first line of defence; replace with Redis (Upstash) once
 * the site sees real traffic.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number }
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  if (existing.count >= options.limit) {
    return { ok: false, retryAfterSec: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { ok: true };
}

/** Best-effort client IP for rate limiting. Trusts X-Forwarded-For only when behind a proxy. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "anon";
}

/**
 * Verify the request originated from our own site. Blocks naive cross-origin
 * abuse but is not a substitute for auth on sensitive endpoints.
 *
 * Allowlist:
 *  - NEXT_PUBLIC_SITE_URL (apex + www variant — whichever isn't configured).
 *  - ALLOWED_ORIGINS: optional comma-separated list of extra full origins
 *    (e.g. `https://staging.example.com,https://example.com`).
 *  - All *.vercel.app preview origins (dev / preview convenience).
 *  - localhost in non-production.
 *
 * Same-origin browser requests omit Origin/Referer entirely — we allow that case;
 * cross-origin browser fetches always send Origin.
 */
export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Allow same-origin and SSR/internal calls (no Origin/Referer).
  if (!origin && !referer) return true;

  const allowed = new Set<string>();
  const addOriginAndAlt = (raw: string) => {
    try {
      const u = new URL(raw);
      allowed.add(u.origin);
      // Toggle www <-> apex so either canonical form works.
      const host = u.hostname;
      if (host.startsWith("www.")) {
        allowed.add(`${u.protocol}//${host.slice(4)}`);
      } else {
        allowed.add(`${u.protocol}//www.${host}`);
      }
    } catch {
      // ignore malformed entries
    }
  };

  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) addOriginAndAlt(site);

  const extra = process.env.ALLOWED_ORIGINS?.trim();
  if (extra) {
    for (const entry of extra.split(",")) {
      const t = entry.trim();
      if (t) addOriginAndAlt(t);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  const candidate = origin ?? (referer ? safeOrigin(referer) : null);
  if (!candidate) return false;
  if (allowed.has(candidate)) return true;
  // Allow Vercel preview deploys.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(candidate)) return true;
  return false;
}

function safeOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Composite guard for write endpoints: origin check + rate limit. Returns null if allowed. */
export function guardWriteRequest(
  req: Request,
  opts: { limit?: number; windowMs?: number; bucketName: string } = {
    bucketName: "default",
  }
): NextResponse | null {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json(
      { error: "forbidden_origin", message: "Cross-origin requests are not permitted." },
      { status: 403 }
    );
  }

  const ip = clientIp(req);
  const limit = opts.limit ?? 20;
  const windowMs = opts.windowMs ?? 60_000;
  const r = rateLimit(`${opts.bucketName}:${ip}`, { limit, windowMs });
  if (!r.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(r.retryAfterSec) },
      }
    );
  }

  return null;
}
