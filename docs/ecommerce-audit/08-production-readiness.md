# 08 — Production Readiness Scorecard

**Overall: 40 / 100 → 🔴 NOT READY FOR PRODUCTION.**
Hard rule applied: unresolved P0 defects (SEC-01..04) force NOT-READY regardless of the number. Unverified functionality cannot receive full marks.

| Category | Weight | Score | Rationale (evidence) |
|---|---:|---:|---|
| Core e-commerce functionality | 20 | **12** | Catalog, cart, wishlist, explore, related, recently-viewed exist but untested. −8 for missing reviews/ratings, recommendations, size charts, and the contradictory guest-checkout (`checkout/page.tsx:79-84`). |
| Checkout & payments | 20 | **6** | Server route is well-designed, but P0 amount-binding gap (`orders/place:147-164`), no webhook/reconciliation, no refunds, no idempotency, and payment-captured-but-no-order path. Heavy deduction. |
| Security | 15 | **3** | Multiple P0 rule bypasses (`firestore.rules:113-126, 228-255`), weak origin/rate-limit (`security.ts`). |
| Order & inventory integrity | 15 | **6** | Atomic server decrement is good (+), but client-decrement open, variant restore broken (`admin/orders/page.tsx:154-178`), no reservation, stranded payments on contention. |
| UI/UX & accessibility | 10 | **5** | Solid design system + a11y basics, but unverified live and real UX gaps (no size chart/reviews, fail-open shipping). Can't score full without live/Lighthouse. |
| Performance & scalability | 5 | **2.5** | Good query batching/transactions; but `force-dynamic` everywhere, client-side search, in-memory rate limiter; nothing measured. |
| Testing & quality | 5 | **0.5** | Zero tests, no CI, no test script. |
| Infrastructure & reliability | 5 | **1.5** | No CI/CD, no monitoring/alerting, fire-and-forget side-effects, Firestore SPOF, no staging/prod separation evidence. |
| SEO & operational compliance | 5 | **3.5** | Strong SEO (JSON-LD, sitemap, robots, OG), GST invoices + legal pages present; −1.5 for query-param URLs/no canonical and compliance items needing legal review. |
| **Total** | **100** | **40** | |

## Why each deduction (expanded)

- **−8 core:** reviews/ratings (MISSING), recommendations (MISSING), size charts (MISSING), guest checkout broken as a product.
- **−14 payments:** P0 SEC-02 (amount binding), SEC-04 (webhook), no refunds, no idempotency, no pending-payment handling.
- **−12 security:** P0 SEC-01, SEC-03; P1 SEC-05, SEC-07, SEC-08.
- **−9 order/inventory:** variant restore bug, open client decrement, no reservation, stranded-payment contention.
- **−5 UI/UX:** unverified + real gaps.
- **−2.5 perf:** `force-dynamic`, client search, non-durable limiter, unmeasured.
- **−4.5 testing:** essentially none.
- **−3.5 infra:** no CI/CD, monitoring, queue; SPOF.
- **−1.5 SEO/compliance:** URL structure + legal verification needed.

## Gate to "READY"
Minimum bar (all must hold):
1. SEC-01..04 fixed and verified (rules closed, amount bound+consumed, webhook+reconciliation live).
2. Automated refund path for cancellations.
3. Variant-aware stock restore.
4. Email verification (at least) enforced for checkout.
5. Smoke-level automated tests for the money path + CI running them.
6. Error monitoring + payment reconciliation alerting.

Re-score after Phase A/B of the roadmap.
