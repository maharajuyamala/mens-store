# 11 — Engineering Backlog (ticketed)

Full specs for the launch-blocker and essential tickets (Phase A/B); Phase C–E carry a compact spec (sequencing/effort already in `09`). Effort in engineer-days. "Tests" lists what must exist in CI.

---

## ECOM-001 — Close Firestore write rules (server-only orders & inventory) · P0 · 2–3d
- **Problem:** `firestore.rules:113-126` lets any client create orders at arbitrary prices and self-set `paymentStatus:"paid"`; `:228-255` lets any client decrement stock.
- **Business impact:** Fraudulent/underpriced orders, fake paid status, inventory griefing. Defeats all server pricing logic.
- **Plan:** Remove the public `orders` `create` rule and `clientInventoryDecrement`. Make `products` writes admin-only. All order creation + stock decrement goes through `/api/orders/place` (Admin SDK). Migrate POS (`placePosSale`/`placeOrder` client path) to a server route or an admin-authenticated endpoint. Keep owner read + the admin status-transition update rules.
- **Files:** `firestore.rules`; `lib/checkout/placeOrder.ts`, `lib/checkout/placePosSale.ts`, `app/admin/inventory/scan/page.tsx` (route POS through server); add `app/api/pos/place/route.ts` if needed.
- **Dependencies:** none (do first).
- **Acceptance:** client SDK order create & stock write are denied; all legit flows still work via server routes.
- **Tests:** unit (rules via emulator) QA-SEC-01/02; integration order placement still succeeds; e2e checkout happy path.

## ECOM-002 — Bind payment to order amount + consume reference · P0 · 2d
- **Problem:** `orders/place:147-164` checks only `status=="verified"`; amount never compared; `cfPaymentId` never consumed.
- **Impact:** Pay-less exploit + single-payment replay.
- **Plan:** At `create-order`, persist the CF `orderId → expectedAmount`. In `verify`, store `amount` (already does) and the merchant `orderId`. In `orders/place`, inside the transaction: read `cashfree_payments/{cfPaymentId}`, assert `status=="verified"`, `amount + ε >= pricing.total` (for online; for COD compare to advance), `consumed != true`; then set `consumed:true, orderId:<orderRef.id>`. Reject with `amount_mismatch` / `payment_already_used`.
- **Files:** `app/api/orders/place/route.ts`, `app/api/payments/cashfree/verify/route.ts`, `app/api/payments/cashfree/create-order/route.ts`.
- **Dependencies:** ECOM-001 (so this is the only path).
- **Acceptance:** mismatched amount and reused ref both rejected; correct payment places exactly one order.
- **Tests:** QA-SEC-03/04, QA-PAY-01/02.

## ECOM-003 — Cashfree webhook + idempotent confirm · P0 · 2–3d
- **Problem:** No webhook; confirmation is browser-only.
- **Impact:** Charged-but-no-order when browser dies.
- **Plan:** Add `POST /api/payments/cashfree/webhook` verifying Cashfree's signature (`x-webhook-signature`). On `PAYMENT_SUCCESS`, idempotently finalize: if an order for that CF orderId exists, no-op; else create it server-side from a persisted pending-cart snapshot keyed by CF orderId. Dedupe by `cfPaymentId`.
- **Files:** new `app/api/payments/cashfree/webhook/route.ts`; persist a `pending_orders/{cfOrderId}` snapshot at `create-order`.
- **Dependencies:** ECOM-002.
- **Acceptance:** duplicate/out-of-order webhooks yield exactly one order; browser-close path still results in an order.
- **Tests:** QA-PAY-05/06, QA-SEC-05.

## ECOM-004 — Reconciliation job · P0 · 2d
- **Problem:** No sweep for captured-payment-without-order.
- **Plan:** Scheduled function (Vercel Cron / Cloud Scheduler) querying `cashfree_payments` where `consumed!=true` older than N minutes; attempt finalize via webhook logic, else flag + alert; optionally auto-refund if cart snapshot missing/expired.
- **Files:** new scheduled route; alerting (ECOM-022).
- **Dependencies:** ECOM-003.
- **Acceptance:** orphaned payments are resolved or alerted within SLA.
- **Tests:** QA-SEC-05.

## ECOM-005 — Compensating auto-refund on post-capture failure · P0/P1 · 1–2d
- **Problem:** `orders/place` failing after capture (e.g. stock race) strands money (`checkout/page.tsx:366-382`).
- **Plan:** When `place` fails after a verified capture, enqueue a refund (ECOM-006) for that `cfPaymentId`, notify the customer, and surface a clear message.
- **Dependencies:** ECOM-006.
- **Tests:** QA-INV-01 (loser not left charged).

## ECOM-006 — Automated refunds · P1 · 2–3d
- **Problem:** Refunds manual; `getRefundableAmount` is display-only.
- **Plan:** Add Cashfree refund API wrapper (`POST /pg/orders/{id}/refunds`), server route `POST /api/payments/cashfree/refund` (admin-auth), cap at `getRefundableAmount(order.pricing)`, persist refund record + status, idempotency key per order.
- **Files:** `lib/payments/cashfree-server.ts` (+refund fn), new route, admin order sheet (`components/admin/AdminOrderDetailSheet.tsx`).
- **Acceptance:** refund issued, capped, tracked; double-refund prevented.
- **Tests:** refund amount cap, idempotency, status persistence.

## ECOM-007 — Variant-aware stock restore · P1 · 1–2d
- **Problem:** `admin/orders/page.tsx:154-178` restores only `sizes`/aggregate, ignores color.
- **Plan:** Reuse the variant model (`lib/products/color-variants.ts` / `variant-stock-write.ts`) to compute the inverse of the decrement using each line's color+size; keep the `inventoryRestored` idempotency guard.
- **Acceptance:** cancelling a color-variant order restores the exact variant once.
- **Tests:** QA-INV-03.

## ECOM-008 — Returns & exchanges · P1 · 3–4d
- **Plan:** `returns/{id}` collection (eligibility window, items, reason, status machine request→approved→picked→received→refunded/restocked), customer UI in account, admin processing, ties into ECOM-006/007. Support partial returns (subset of lines).
- **Acceptance:** partial return refunds only returned lines and restocks them.
- **Tests:** QA-ORD-03 + partial-return cases.

## ECOM-009 — Enforce verification · P1 · 1–2d
- **Plan:** Gate checkout (or COD specifically) on `auth.currentUser.emailVerified`; add resend prompt; optional phone OTP via Firebase phone auth.
- **Files:** `checkout/page.tsx`, `AuthProvider.tsx`.
- **Tests:** QA-AUTH-02.

## ECOM-010 — Usable guest checkout · P2 · 2d
- **Plan:** Remove the forced sign-in redirect; support guest order via server route (already allowed) with email capture; or make phone-OTP the primary low-friction path.
- **Files:** `checkout/page.tsx:79-84`.
- **Tests:** guest places order; order readable via confirmation cache.

## ECOM-011 — Coupon caps · P1 · 1d
- **Plan:** Add `usageLimit` (global) + enforce in the order transaction (compare `usageCount`); require auth for `oncePerCustomer`/`newCustomerOnly` at the server; enforce in `orders/place`.
- **Files:** `lib/checkout/coupon.ts`, `orders/place/route.ts`, `coupons/validate/route.ts`.
- **Tests:** QA-SEC-06/07.

---

## Phase C–E (compact specs)

| Ticket | Problem → Outcome | Files (indicative) | Accept | Tests | Effort | Pri |
|---|---|---|---|---|---|---|
| ECOM-012 Reviews/ratings | No social proof → moderated reviews w/ verified-purchase badge, aggregateRating in JSON-LD | `products/{id}/reviews`, PDP, admin moderation | review gated to purchasers; avg rating shown | unit(avg), e2e(submit/moderate) | 3–4 | P2 |
| ECOM-013 Size charts/specs | No fit info → per-category size chart + spec table | product model, PDP | chart renders per category | snapshot | 2 | P2 |
| ECOM-014 Address book | Single address → multiple saved addresses | `users/{uid}/addresses`, checkout | pick/add/edit/delete | unit+e2e | 2 | P2 |
| ECOM-015 Server search | Client filter → Algolia/Typesense, typo-tolerant, faceted | index sync on product write, search UI | typo returns match; scales | integration | 3–4 | P2 |
| ECOM-016 Shipping fail-closed | Silent free → flagged/blocked when quote missing; PDP delivery date | `recompute-pricing.ts`, PDP | no silent free shipping | unit | 1–2 | P2 |
| ECOM-017 Recommendations | Related-only → "you may also like"/"bought together" | product-queries, PDP/cart | relevant recs shown | unit | 2–3 | P2 |
| ECOM-018 Distributed rate limit | In-memory → Upstash + auth on writes | `lib/api/security.ts` | limits hold across fleet | integration | 1–2 | P1 |
| ECOM-019 Security headers | None → CSP/HSTS/XCTO/referrer | `next.config.ts` | headers present | header test | 1 | P2 |
| ECOM-020 ISR caching | force-dynamic → ISR for catalog/PDP | page configs, revalidate hooks | TTFB down, fresh on write | perf check | 2–3 | P2 |
| ECOM-021 Durable side-effects | Fire-and-forget → queue/scheduled | email/shiprocket flows | retried, not dropped | integration | 2 | P1 |
| ECOM-022 Monitoring | None → Sentry + reconcile alerts + health | app-wide | errors/alerts visible | — | 1–2 | P1 |
| ECOM-023 SMS/WhatsApp | Email-only → multi-channel + retry/dedupe | notifications service | sent once, retried | integration | 3–4 | P2 |
| ECOM-024 Abandoned cart | None → capture + recovery emails | cart snapshot, scheduler | recovery sent | integration | 2–3 | P2 |
| ECOM-025 Analytics | None → GA4 + server conversion events | layout, checkout | events fire | e2e | 2 | P2 |
| ECOM-026 Bulk import/audit/low-stock | Manual → CSV import + inventory audit log + alerts | admin tools | import validates; log written | unit+e2e | 3–4 | P2 |
| ECOM-027 CI/CD + staging | None → pipeline runs tests, staging env | `.github/workflows` | PRs gated by tests | — | 2–3 | P1 |

## Quick wins (<1d each)
`notify-status` super_admin fix · max-qty alignment · canonical tag + checkout `<h1>` · remove dead import · consolidate image pipeline · tighten `newsletter_subscribers` create.
