# 04 — Security Audit (OWASP-aligned)

Scope: static review of source + Firestore/Storage rules. No live exploitation performed. Each item cites evidence.

## Critical (P0)

### SEC-01 — Broken Access Control: client can create arbitrarily-priced "paid" orders
- **OWASP:** A01 Broken Access Control / A08 Data Integrity.
- **Where:** `firestore.rules:113-126` (`orders` create), `:101-109` (`validPricing`).
- **Why:** No auth required; per-item prices not validated; no `hasOnly`, so attacker can set `paymentStatus:"paid"` and a fake `payment` map. Bypasses `/api/orders/place` entirely.
- **Impact:** Fraudulent orders at ₹1, fake paid status → fulfillment/financial loss.
- **Fix:** Remove client `create` on `/orders`; route all order creation through the Admin SDK (`/api/orders/place`). If any client create must remain, require `request.auth.uid == userId`, forbid `paymentStatus`/`payment` on create, and validate line prices against `get(products/…)` (expensive — prefer server-only).

### SEC-02 — Payment not bound to order amount; payment reference replayable
- **OWASP:** A08 Integrity / A04 Insecure Design.
- **Where:** `payments/cashfree/verify/route.ts:95-108` (stores amount but doesn't bind it), `orders/place/route.ts:147-164` (checks only `status=="verified"`).
- **Why:** No check that `cashfree_payments.amount == pricing.total`; the `cfPaymentId` is never marked consumed, so it can back multiple orders.
- **Impact:** Pay ₹1 → receive ₹10,000 cart; one payment → many orders.
- **Fix:** Record the CF order's expected amount at create time; in `place`, verify `amount >= total` (within paise tolerance) and atomically mark the payment doc `consumed:true` inside the order transaction (fail if already consumed).

### SEC-03 — Broken Access Control: client can decrement inventory directly
- **OWASP:** A01.
- **Where:** `firestore.rules:228-255` (`clientInventoryDecrement`).
- **Why:** Any client may lower `stock`/`sizes` values on any product.
- **Impact:** Denial-of-inventory (zero out a competitor's or your own catalog), and it enables SEC-01's fake orders to look stock-consistent.
- **Fix:** Make product writes admin-only; perform all decrements server-side in the order transaction.

### SEC-04 — Missing payment webhook / no reconciliation
- **OWASP:** A04 Insecure Design.
- **Where:** no `app/api/payments/cashfree/webhook` route exists; flow is browser-driven (`checkout/page.tsx:250-299`).
- **Why:** If the browser dies after capture, or `place` fails post-capture, money is captured with no order and nothing reconciles.
- **Impact:** Charged-but-no-order; customer disputes; manual refunds.
- **Fix:** Add a signature-verified Cashfree webhook that creates/confirms the order idempotently; add a periodic reconciliation job over `cashfree_payments` without a matching order.

## High (P1)

### SEC-05 — Weak origin check + non-durable rate limiting
- **OWASP:** A05 Misconfiguration / A04.
- **Where:** `lib/api/security.ts:33-39` (IP from `X-Forwarded-For`, trivially spoofable off-proxy), `:59-60` (no Origin+Referer ⇒ **allowed**), `:99` (any `*.vercel.app` allowed), `:10` (in-memory bucket).
- **Why:** A script simply omits Origin/Referer to pass the "CSRF" guard; the rate limiter is per-lambda-instance and resets on cold start, so limits don't hold across Vercel's fleet.
- **Impact:** Scripted abuse of every write endpoint (coupon brute force, order spam, create-order spam).
- **Fix:** Require auth (bearer) on sensitive writes; move rate limiting to Upstash/Redis keyed on uid+IP; treat missing Origin as suspicious for state-changing calls.

### SEC-06 — Server-side price validation is correct but not the only path
- **OWASP:** A04.
- **Where:** `lib/server/recompute-pricing.ts` (good) vs `firestore.rules` (open). Also `create-order` trusts a client `discount` (`create-order/route.ts:92-99`) to set the charge — mitigated only because amount isn't later reconciled (which is itself SEC-02).
- **Fix:** As SEC-01/02. Resolve coupon server-side in `create-order` too, so the charged amount already reflects the authoritative discount.

### SEC-07 — Coupon abuse: no global cap; per-customer limits bypassable
- **OWASP:** A04 / Business logic.
- **Where:** `lib/checkout/coupon.ts` (no `usageLimit`/`maxRedemptions` field), `orders/place:229-251` (per-user checks only when `uid` present). `usageCount` is incremented but never compared to a cap (`orders/place:437-454`).
- **Impact:** Unlimited global redemptions; guest/direct-API callers skip once-per-customer and new-customer-only.
- **Fix:** Add and enforce a global cap; require auth for restricted coupons at the server; enforce in the order transaction.

### SEC-08 — AuthN weaknesses
- Email verification never enforced (`AuthProvider.tsx:235-239`) — unverified emails can place orders.
- No phone/OTP verification.
- Password policy delegated to Firebase defaults (not configured/reviewed here).
- **Fix:** Gate checkout (or at least COD) on `emailVerified`; add OTP for phone; document Firebase password policy.

### SEC-09 — `notify-status` role check inconsistent
- **Where:** `orders/notify-status/route.ts:77` checks `role === "admin"`, excluding `super_admin` (which `isAdmin()` in rules includes).
- **Impact:** super_admins can change status (rules allow) but can't trigger the email → missed notifications. Low security risk, correctness bug.

## Medium (P2)

### SEC-10 — IDOR-adjacent: order create doesn't bind `userId` to auth
- **Where:** `firestore.rules:117` requires only `userId is string`.
- **Impact:** A signed-in user can attribute orders to another uid (or spoof "guest"). Read is still scoped, so this is integrity, not disclosure.

### SEC-11 — Sensitive data exposure surface
- Coupon docs world-readable (`firestore.rules:67`) — exposes discount config.
- PII (name/email/phone/address) sent to Resend and Shiprocket (expected), and logged via `console.error` on failures (`orders/place:166,295,464`) — review log sinks to ensure PII isn't retained in plaintext logs.
- `newsletter_subscribers` open create (`:78-82`) — spam/enumeration vector.

### SEC-12 — File upload
- ImageKit upload tokens are admin-gated (`imagekit/auth/route.ts`) and image validation exists (`lib/uploads/validate-image.ts`) — **good**. Verify server-side MIME/size enforcement matches client checks.

## Low (P3)
- CORS/security headers: no custom `headers()` in `next.config.ts` (no CSP, HSTS, X-Content-Type-Options). Add security headers.
- Storage rules (`storage.rules`) are small — review that they restrict writes to admins.
- `middleware.ts` admin gate is cosmetic only (documented as such) — fine, real checks exist, but ensure no route relies on it for security.

## OWASP coverage quick map

| Category | Finding |
|---|---|
| A01 Broken Access Control | SEC-01, SEC-03, SEC-10 |
| A02 Cryptographic Failures | Low (tokens via Firebase; secrets server-only) |
| A03 Injection | Low — Firestore (no SQL); zod validation on bodies; JSON-LD uses `JSON.stringify` (no raw interpolation) |
| A04 Insecure Design | SEC-02, SEC-04, SEC-06, SEC-07 |
| A05 Misconfiguration | SEC-05, SEC-11, headers |
| A07 Auth Failures | SEC-08 |
| A08 Integrity Failures | SEC-01, SEC-02, SEC-04 |
| A09 Logging/Monitoring | No central logging/alerting (see `08`) |

## Attacker-goal checklist (from the brief)

| Can an attacker… | Verdict | Why |
|---|---|---|
| Purchase at manipulated prices | **YES** | SEC-01, SEC-02 |
| Access another customer's PII | Limited | Read rules scope orders; create doesn't bind userId |
| Reuse restricted coupons | **YES (guest/API)** | SEC-07 |
| Create duplicate refunds | N/A | No refund API exists (manual) |
| Access restricted admin endpoints | No (server routes verify role) | `admin/*` routes check `users/{uid}.role` |
| Purchase unavailable inventory | Mostly no (server tx) | But direct-write path + no reservation |
