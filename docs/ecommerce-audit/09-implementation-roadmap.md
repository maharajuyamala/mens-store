# 09 — Implementation Roadmap

Phases are ordered by risk. Full per-ticket detail (problem, plan, files, acceptance, tests, effort) is in `11-engineering-backlog.md`; this file is the sequencing view. Effort in engineer-days (d), rough.

## Phase A — Critical launch blockers (neutralize all P0s) · ~8–12d
| Ticket | Title | Effort |
|---|---|---|
| ECOM-001 | Lock down Firestore rules: remove client `orders` create + `clientInventoryDecrement`; route all writes via Admin SDK | 2–3d |
| ECOM-002 | Bind payment to order amount + mark `cfPaymentId` consumed atomically | 2d |
| ECOM-003 | Cashfree webhook (signature-verified) + idempotent order confirm | 2–3d |
| ECOM-004 | Reconciliation job: captured payments without orders → alert + auto-order/refund | 2d |
| ECOM-005 | Compensating auto-refund when `orders/place` fails after capture | 1–2d |

**Exit criteria:** price-manipulation and payment-replay are impossible; no "charged but no order" without reconciliation; P0s closed and covered by tests.

## Phase B — Essential business functionality · ~8–12d
| Ticket | Title | Effort |
|---|---|---|
| ECOM-006 | Automated refunds (Cashfree refund API) wired to cancellation workflow, capped at refundable amount | 2–3d |
| ECOM-007 | Variant-aware stock restore on cancel/return | 1–2d |
| ECOM-008 | Returns & exchanges workflow (request → approve → refund/restock) | 3–4d |
| ECOM-009 | Enforce email verification (and optional phone OTP) for checkout | 1–2d |
| ECOM-010 | Guest checkout (or phone-OTP login) actually usable in UI | 2d |
| ECOM-011 | Coupon global usage cap + server-enforced per-customer limits | 1d |

## Phase C — Customer experience · ~10–15d
| Ticket | Title | Effort |
|---|---|---|
| ECOM-012 | Product reviews & ratings (moderated) | 3–4d |
| ECOM-013 | Size charts + richer specs on PDP | 2d |
| ECOM-014 | Address book (multiple saved addresses) | 2d |
| ECOM-015 | Server-side search (Algolia/Typesense) with typo tolerance | 3–4d |
| ECOM-016 | Make shipping fail-closed / clearly flagged; delivery date on PDP | 1–2d |
| ECOM-017 | Recommendations / cross-sell ("you may also like", "frequently bought") | 2–3d |

## Phase D — Security & performance hardening · ~6–9d
| Ticket | Title | Effort |
|---|---|---|
| ECOM-018 | Distributed rate limiting (Upstash) + require auth on sensitive writes | 1–2d |
| ECOM-019 | Security headers (CSP/HSTS/etc.) + CORS review | 1d |
| ECOM-020 | ISR/edge caching for catalog + PDP (drop blanket `force-dynamic`) | 2–3d |
| ECOM-021 | Move side-effects (emails, Shiprocket, reconciliation) to a durable queue/scheduled fn | 2d |
| ECOM-022 | Error monitoring (Sentry) + payment reconciliation alerting + health checks | 1–2d |

## Phase E — Growth & advanced · ~10–16d
| Ticket | Title | Effort |
|---|---|---|
| ECOM-023 | SMS/WhatsApp notifications (order/shipping/refund) with retry + dedupe | 3–4d |
| ECOM-024 | Abandoned-cart recovery | 2–3d |
| ECOM-025 | Analytics + conversion tracking (GA4/pixel, server events) | 2d |
| ECOM-026 | Bulk product import (CSV) + inventory audit log + low-stock alerts | 3–4d |
| ECOM-027 | CI/CD pipeline + staging env + automated test suite in CI | 2–3d |

## Quick wins (do alongside Phase A, each < 1d)
- Fix `notify-status` to accept `super_admin` (`notify-status/route.ts:77`).
- Align client/server max-qty (`cartStore.ts:41` vs `orders/place:51`).
- Add `alternates.canonical` to PDP metadata; add checkout page `<h1>`.
- Remove dead `void Timestamp` import; consolidate Cloudinary→ImageKit.
- Restrict `newsletter_subscribers` create (basic rate/shape) and review `storage.rules`.

## Suggested sequencing
Phase A → B are **mandatory before taking real payments**. C/D/E are post-launch, prioritized by revenue impact (reviews, search, WhatsApp, abandoned cart first within C/E).
