# 06 — Performance & Scalability

**Method:** architectural assessment from source + config. **No Lighthouse run, no load test, no measured latencies** (no running app in this environment). All numbers below are clearly labeled as estimates; none are measured. Per the brief, measured vs estimated is kept distinct.

## Core Web Vitals — NOT MEASURED
LCP / INP / CLS were not measured. To measure: deploy to a preview, run Lighthouse + WebPageTest + field CrUX. Structural observations that will affect them:

- **`export const dynamic = "force-dynamic"` is set widely** (`product-details/page.tsx:11`, `sitemap.ts:5`, every API route). This disables static generation and full-route caching → every PDP is server-rendered per request → higher TTFB and server cost than an ISR/SSG apparel catalog needs.
- **Images:** ImageKit CDN + `next/image` remote patterns configured (`next.config.ts`) — good for LCP if `priority`/sizes are set (verify per component).
- **Client-heavy:** cart/wishlist/search are client components; bundle size unmeasured. Framer-motion, html5-qrcode, jsbarcode, qrcode add weight — ensure the QR/barcode libs are **admin-route-only** (code-split), not in the storefront bundle.

## Backend / data layer

| Area | Observation | Risk |
|---|---|---|
| Query batching | `recompute-pricing.ts:183-191` batches product reads via `documentId() in` chunks of 10 — avoids N+1. Good. | Low |
| Transactions | Order placement uses a single Firestore transaction with pre-reads (`orders/place:368-456`) — correct pattern. | Low |
| Caching | `cache: "no-store"` on Cashfree/Shiprocket calls (correct for those); but no caching of product/catalog reads; `force-dynamic` everywhere. | Med — cost + latency |
| Search | Client-side filtering of listed products (`search-listed-products.ts`) → downloads a product set to the browser; won't scale past a few hundred SKUs. | Med/High at catalog growth |
| Pagination | Explore pagination needs review; large catalogs need cursor pagination + server search. | Med |
| Connection pooling | N/A (Firestore managed). Admin SDK singleton in `firebase-admin.ts` (verify it isn't re-init per request on warm lambdas). | Low |
| Rate limiting | In-memory per-instance (`security.ts:10`) — ineffective at scale and under load. | Med |

## Concurrency & integrity

- **Last-item contention (100 buyers):** the order transaction re-reads and decrements atomically, so Firestore serializes contending writes to the same product doc → exactly one winner, others get `INSUFFICIENT_STOCK`. **Correctness: OK.** **But** Firestore contention on a single hot product doc has limited write throughput (~1 sustained write/sec/doc guidance); a flash sale on one SKU will see high contention/retries/latency. And losers who **prepaid** have captured payments with no order and no auto-refund (see `03`/`04`).
- **No stock reservation**: inventory is only decremented at commit, so oversell is prevented but cart-stage availability can be stale.

## Scalability estimates (ARCHITECTURAL, NOT MEASURED)

| Load | Likely behavior (estimate) |
|---|---|
| 100 concurrent users | Fine functionally. Firestore + Vercel handle this; cost from `force-dynamic` SSR is the main inefficiency. Hot-SKU flash sales could show contention. |
| 1,000 concurrent | Needs caching/ISR for catalog + CDN; client-side search becomes a liability; in-memory rate limiter useless; email/shipping fire-and-forget may drop under pressure. |
| 10,000 concurrent | Not viable as-is without: server-side search (Algolia/Typesense), ISR/edge caching, a durable queue for post-order side-effects, distributed rate limiting, and sharded/denormalized inventory for hot SKUs. |

## Single points of failure
- **Firestore** (sole datastore + authz). An outage or rules mistake takes down reads, writes, and security at once.
- **Fire-and-forget side effects** (email, Shiprocket booking) — if the request ends or the function freezes, they silently don't happen; no retry/queue.
- **In-request external calls** (Cashfree, Shiprocket) with no circuit breaker; Shiprocket is fail-open (masks outages but leaks shipping revenue).

## Recommendations (scaled to current business)
1. Turn catalog/PDP into ISR (revalidate on product write) instead of `force-dynamic` — biggest, cheapest win.
2. Move side-effects (emails, Shiprocket, reconciliation) to a durable queue / scheduled function.
3. Introduce server-side search when catalog > a few hundred SKUs.
4. Distributed rate limiting (Upstash).
5. Measure before optimizing further: add Lighthouse CI + real-user monitoring.
