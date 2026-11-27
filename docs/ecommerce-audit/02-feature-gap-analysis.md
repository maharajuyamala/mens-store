# 02 — Feature Gap Analysis

Status legend: **FULLY WORKING** (verified by evidence), **PARTIAL**, **UNVERIFIED** (code exists, behavior not executed), **BROKEN**, **MISSING**, **N/A**.
Because nothing was executed live, items that are code-complete but untested are marked **UNVERIFIED** rather than FULLY WORKING, per the audit rules.

## 1. Authentication & Customer Accounts

| Feature | Status | Evidence / Notes |
|---|---|---|
| Registration (email/password) | UNVERIFIED | `AuthProvider.tsx:220-242` creates auth user + `users/{uid}` doc |
| Login (email/password + Google) | UNVERIFIED | `signIn`, `signInWithGoogle` `AuthProvider.tsx:216-252` |
| Guest checkout | PARTIAL/BROKEN | Backend allows guests (`orders/place:117-130`) but UI forces sign-in (`checkout/page.tsx:79-84`). Not usable as designed. |
| Email verification | PARTIAL | Sent on signup, **never enforced** anywhere. `AuthProvider.tsx:235-239` |
| Mobile/OTP verification | MISSING | Phone is a free-text field only |
| Forgot/reset password | UNVERIFIED | `sendPasswordReset` `AuthProvider.tsx:254-256` |
| Session management | UNVERIFIED | Firebase client tokens; non-security UI cookie `mens-store-signed-in` (`AuthProvider.tsx:114-126`) |
| Profile management | UNVERIFIED | `app/account/page.tsx`; rules owner-only, role immutable (`firestore.rules:46-48`) |
| Multiple delivery addresses | MISSING | Only a single saved address in localStorage (`lib/checkout/saved-delivery.ts`) |
| Account deletion | MISSING | `firestore.rules:49` `allow delete: if false`; no self-delete flow |
| Authorization / RBAC | PARTIAL | Role model good server-side; but order/stock write rules are open (see `04`) |

## 2. Product Catalog

| Feature | Status | Evidence |
|---|---|---|
| Products / categories / subcategories | UNVERIFIED | `lib/add-product/category-options.ts`, explore filters |
| Variants (size/color/material/SKU) | PARTIAL | size + color variants (`lib/products/color-variants.ts`, `variant-code.ts`); material/SKU limited |
| Images / galleries | UNVERIFIED | ImageKit, `images[]` |
| Pricing / discounts / tax | PARTIAL | GST-inclusive pricing + breakdown (`lib/checkout/gst.ts`); server recompute good; **but direct-write bypass** |
| Variant-level inventory | PARTIAL | `getStockForLine` variant-aware read; restore path ignores variants (`04`/GAP-007) |
| Size charts | MISSING | No size-chart component (only legal text mentions it) |
| Product specifications | PARTIAL | Basic fields only |
| Related products | UNVERIFIED | `lib/server/product-queries.ts` `fetchProductPageData.related` |
| Recommendations (personalized/cross-sell) | MISSING | No recommendation engine |
| Ratings & reviews | MISSING | No reviews/ratings collection or UI |
| Out-of-stock handling | UNVERIFIED | JSON-LD availability (`product-details/page.tsx:24-27`), revalidateCart |
| Product availability | UNVERIFIED | archived/active gates in `recompute-pricing.ts:205-210` |

## 3. Search & Discovery

| Feature | Status | Evidence |
|---|---|---|
| Search | PARTIAL | `components/search/GlobalSearchCommand.tsx`, `lib/client/search-listed-products.ts` (client-side filter) |
| Autocomplete / suggestions | PARTIAL | cmdk command palette |
| Typo tolerance | MISSING | No fuzzy/typo engine (no Algolia/Typesense) |
| Filters & sorting | UNVERIFIED | `lib/explore/filters.ts` |
| Category navigation | UNVERIFIED | explore page |
| Pagination | UNVERIFIED | needs review of explore query |
| Recently viewed | UNVERIFIED | `store/recentlyViewedStore.ts`, `RecentlyViewedSection.tsx` |
| Empty search results | UNVERIFIED | needs UI check |
| Mobile search | UNVERIFIED | responsive dialog |

## 4. Shopping Cart & Wishlist

| Feature | Status | Evidence |
|---|---|---|
| Add/update/remove | UNVERIFIED | `store/cartStore.ts` |
| Variant selection | UNVERIFIED | line key includes size+color (`cartStore.ts:43-45`) |
| Quantity validation | PARTIAL | client MAX_QTY=10; server max 50 (`orders/place:51`) — mismatch |
| Cart persistence | PARTIAL | localStorage only; no server cart, no cross-device |
| Guest→user cart migration | MISSING | cart not merged on sign-in (wishlist is; cart isn't) |
| Coupon application | UNVERIFIED | `coupons/validate` + checkout |
| Invalid/expired coupons | UNVERIFIED | `evaluateCouponEligibility` |
| Price change after add | PARTIAL | `revalidateCart` checks stock, **not price** |
| Stock change after add | UNVERIFIED | `revalidate-cart.ts`, AuthProvider scrub |
| Wishlist persistence | UNVERIFIED | merges local+remote on sign-in (`lib/wishlist/sync.ts`) |
| Subtotal/discount/tax/shipping math | UNVERIFIED | `lib/checkout/pricing.ts` + server recompute |

## 5. Checkout

| Feature | Status | Evidence |
|---|---|---|
| Guest vs authenticated | BROKEN (guest) | UI blocks guests (`checkout/page.tsx:79-84`) |
| Address selection/validation | PARTIAL | zod schema; single address |
| PIN serviceability | PARTIAL | `checkPincodeServiceable`; **fail-open** (`recompute-pricing.ts:263-284`) |
| Shipping options | PARTIAL | cheapest Shiprocket rate only |
| Estimated delivery date | UNVERIFIED | ETD from serviceability |
| Order summary | UNVERIFIED | step 2 UI |
| Coupon validation | UNVERIFIED | server |
| Tax calc | UNVERIFIED | GST breakdown |
| Final price verification | PARTIAL | server recompute good; bypassable via rules |
| Duplicate order prevention | MISSING | no idempotency key |
| Checkout recovery after interruption | MISSING | no resume / webhook |

## 6. Payment System

| Feature | Status | Evidence |
|---|---|---|
| UPI / cards / netbanking | UNVERIFIED | Cashfree Drop-in (all methods) |
| COD | PARTIAL | COD requires online advance (`COD_ADVANCE_INR`) |
| Gateway integration | UNVERIFIED | `lib/payments/cashfree-server.ts` |
| Success/failure/cancel | PARTIAL | handled client-side; cancel toast |
| Pending payment handling | MISSING | no pending/async settlement path |
| Webhook signature verification | MISSING | **no webhook at all** |
| Payment idempotency | MISSING | payment ref not consumed (`orders/place:147-164`) |
| Duplicate payment prevention | MISSING | none |
| Payment reconciliation | MISSING | no job |
| Refunds (full/partial) | MISSING | manual only (`refund-policy.ts` display-only) |
| Payment retry | PARTIAL | user can re-run modal; no linkage |
| **Amount bound to order** | **BROKEN (P0)** | verified payment amount never checked vs total |

## 7. Order Management

| Feature | Status | Evidence |
|---|---|---|
| Order creation | PARTIAL | server route good; direct-write open |
| Order confirmation | UNVERIFIED | `order-confirmation/page.tsx` + cache |
| Status lifecycle | UNVERIFIED | `allowedNextStatuses` + rules transition graph |
| Invalid transition prevention | UNVERIFIED | enforced in rules (`:90-96`) + admin tx |
| Order history | UNVERIFIED | `users/{uid}/orders` mirror |
| Invoice generation | UNVERIFIED | `account/orders/[id]/invoice`, GST receipt |
| Shipment tracking | PARTIAL | AWB link only when present |
| Cancellation | PARTIAL | request doc + admin action; **variant restore broken** |
| Partial cancellation | MISSING | whole-order only |
| Returns & exchanges | MISSING | no return workflow |
| Refund tracking | MISSING | manual |
| Failed delivery / RTO | MISSING | not modeled |
| Customer notifications | PARTIAL | email only, fire-and-forget |

## 8. Inventory Management

| Feature | Status | Evidence |
|---|---|---|
| Real-time stock | UNVERIFIED | Firestore reads |
| Variant-level stock | PARTIAL | read ok; restore ignores variants |
| Stock reservation during checkout | MISSING | decrement only at order commit |
| Concurrent purchase handling | PARTIAL | server tx atomic; but loser's payment stranded |
| Overselling prevention | PARTIAL | server tx good; client-decrement path risky |
| Stock release after failed payment | N/A→OK | no order ⇒ no decrement (payment-first) |
| Stock restoration on cancel/return | PARTIAL/BROKEN | variant case broken (`admin/orders/page.tsx:154-178`) |
| Low-stock alerts | MISSING | none |
| Inventory adjustment history | MISSING | no audit trail |

## 9. Admin Dashboard

| Feature | Status | Evidence |
|---|---|---|
| RBAC | UNVERIFIED | `AdminGuard.tsx`, middleware, rules |
| Product management | UNVERIFIED | `admin/products`, `admin/add-product` |
| Category management | PARTIAL | static options file |
| Bulk product import | MISSING | no CSV import |
| Inventory management | UNVERIFIED | `admin/inventory/scan` (barcode POS) |
| Customer management | UNVERIFIED | `admin/users` (super_admin) |
| Order processing | UNVERIFIED | `admin/orders/page.tsx` |
| Shipment management | PARTIAL | Shiprocket booking |
| Returns/refunds | MISSING | no module |
| Coupons/promotions | UNVERIFIED | `admin/coupons` |
| Banner/homepage mgmt | PARTIAL | `admin/media`, static hero components |
| Sales analytics / revenue | PARTIAL | `lib/admin/order-stats.ts`, CSV export |
| Audit logs | MISSING | only statusHistory + roleUpdatedBy |
| Export | UNVERIFIED | `ordersToCsv` |

## 10. Notifications & Support

| Feature | Status | Evidence |
|---|---|---|
| Order confirmation email | PARTIAL | fire-and-forget (`orders/place:471-498`) |
| Shipping/delivery/payment-fail/refund emails | PARTIAL | status email (`notify-status`); no payment-fail or refund emails |
| SMS / WhatsApp | MISSING | none |
| Notification retry | MISSING | none |
| Duplicate notification prevention | MISSING | none |
| Contact support | UNVERIFIED | `(legal)/contact` |
| Complaint handling | MISSING | no ticketing |

## 11. Promotions & Marketing

| Feature | Status | Evidence |
|---|---|---|
| Discount codes (%/flat) | UNVERIFIED | coupon model |
| Eligibility / min order / per-customer | PARTIAL | enforced for signed-in only; no global cap |
| Campaigns | MISSING | no campaign engine |
| Abandoned-cart recovery | MISSING | none |
| Analytics integration | MISSING | no GA/pixel |
| Conversion tracking | MISSING | none |
| Cross-sell / upsell | MISSING | related-only |

---

## Consolidated Gap Analysis (Phase 9)

Confirmed defects are separated from suspected/untested risks. Effort in engineer-days.

### Confirmed defects

| Gap ID | Module | Feature | Status | Expected | Actual | Sev | Business impact | File:Line | Fix | Effort |
|---|---|---|---|---|---|---|---|---|---|---|
| GAP-001 | Orders/Security | Order creation authz | BROKEN | Only server can set price/paid | Any client creates orders at any price, self-marks paid | **P0** | Fraudulent/underpriced fulfilled orders | `firestore.rules:113-126` | Admin-SDK-only order writes | 2–3 |
| GAP-002 | Payments | Amount binding | BROKEN | Paid amount == order total; one-time use | Amount unchecked; ref replayable | **P0** | Pay ₹1 get ₹10k; replay | `orders/place:147-164`, `cashfree/verify:95-108` | Bind + consume payment | 2 |
| GAP-003 | Inventory/Security | Stock write authz | BROKEN | Server-only decrement | Any client decrements stock | **P0** | Inventory griefing | `firestore.rules:228-255` | Admin-only product writes | (w/ GAP-001) |
| GAP-004 | Payments | Webhook/reconcile | MISSING | Webhook confirms order | Browser-only; captured-no-order | **P0** | Charged, no order, manual refund | no webhook route | Add webhook + reconcile | 4–5 |
| GAP-005 | Payments | Automated refunds | MISSING | Refund via gateway | Manual/off-platform | **P1** | Slow refunds, disputes | `orders/cancellation.ts` | Cashfree refund API | 2–3 |
| GAP-006 | Inventory | Variant stock restore | BROKEN | Restore exact variant | Restores sizes/aggregate only | **P1** | Variant stock wrong after cancel | `admin/orders/page.tsx:154-178` | Variant-aware restore | 1–2 |
| GAP-007 | Security | Origin/rate limit | PARTIAL | Durable, enforced | Bypassable + per-instance | **P1** | Scripted abuse/brute force | `lib/api/security.ts:33-101` | Auth + Redis limiter | 1–2 |
| GAP-008 | Auth | Email/phone verification | PARTIAL | Enforced before order | Sent, never enforced; no OTP | **P1** | Fake accounts, COD abuse | `AuthProvider.tsx:235-239` | Gate checkout on verified | 1–2 |
| GAP-009 | Promotions | Coupon caps | PARTIAL | Global + per-user caps | No global cap; guest bypass | **P1** | Discount leakage | `coupon.ts`, `orders/place:437-454` | Enforce caps server-side | 1 |
| GAP-010 | Quality | Tests/CI | MISSING | Automated tests + CI | None | **P1** | Regressions ship silently | `package.json`, no `.github/` | Add tests + CI | 2–3 |
| GAP-011 | Checkout | Guest checkout | BROKEN | Checkout w/o account | UI forces sign-in | **P2** | Lost conversions | `checkout/page.tsx:79-84` | Enable guest/OTP | 2 |
| GAP-012 | Shipping | Fail-open rates | PARTIAL | Fail-closed/flagged | Silent free shipping | **P2** | Revenue leak + bad delivery | `recompute-pricing.ts:263-284` | Fail-closed + flag | 1 |
| GAP-013 | Notifications | SMS/WhatsApp + retry | MISSING | Multi-channel + retry | Email only, no retry | **P2** | Missed comms (India) | `email/resend.ts` | Add channels | 3–4 |
| GAP-014 | Orders | notify-status role | BROKEN | admin+super_admin | Excludes super_admin | **P2** | Missed emails | `notify-status:77` | Use roleGrantsAdminShell | <1 |

### Missing capabilities (gaps, not defects)

| Gap ID | Module | Feature | Sev | Effort |
|---|---|---|---|---|
| GAP-015 | Catalog | Reviews & ratings | P2 | 3–4 |
| GAP-016 | Catalog | Size charts | P2 | 2 |
| GAP-017 | Discovery | Server search + typo tolerance | P2 | 3–4 |
| GAP-018 | Orders | Returns & exchanges | P1 | 3–4 |
| GAP-019 | Accounts | Address book (multiple) | P2 | 2 |
| GAP-020 | Marketing | Abandoned cart + analytics + conversion | P2 | 4–5 |
| GAP-021 | Catalog | Recommendations/upsell | P2 | 2–3 |
| GAP-022 | Admin | Bulk import + audit log + low-stock alerts | P2 | 3–4 |
| GAP-023 | Infra | Monitoring/alerting + staging + CI/CD | P1 | 3–4 |

### Suspected risks / untested (need live verification)
- All **UNVERIFIED** rows in the module tables above (registration, login, profile, invoices, admin flows) — code exists, behavior not executed.
- Core Web Vitals, bundle size, real concurrency behavior, accessibility conformance — not measured (see `06`, `05`).

