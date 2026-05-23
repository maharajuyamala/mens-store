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
 * Allowlist: NEXT_PUBLIC_SITE_URL plus all *.vercel.app preview origins (dev convenience).
 * Same-origin browser requests omit Origin/Referer entirely — we allow that case;
 * cross-origin browser fetches always send Origin.
 */
export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // Allow same-origin and SSR/internal calls (no Origin/Referer).
  if (!origin && !referer) return true;

  const allowed = new Set<string>();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (site) {
    try {
      allowed.add(new URL(site).origin);
    } catch {
      // ignore bad env value
    }
  }
  if (process.env.NODE_ENV !== "production") {
    allowed.add("http://localhost:3000");
    allowed.add("http://127.0.0.1:3000");
  }

  const candidate = origin ?? (referer ? safeOrigin(referer) : null);
  if (!candidate) return false;
  if (allowed.has(candidate)) return true;
  // Allow Vercel preview deploys when site var is unset (CI/dev).
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
