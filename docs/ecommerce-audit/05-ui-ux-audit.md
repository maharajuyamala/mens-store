# 05 — UI/UX Audit & Competitor Benchmarking

**Method:** desk review of component source (no live browser session, no screenshots captured — the environment has no running app). Competitor behaviors are described from general knowledge and **marked UNVERIFIED**; the brief explicitly says not to claim current competitor functionality without verifying it.

## What's genuinely good

- **Design system:** shadcn/ui + Radix + Tailwind v4 (`components/ui/*`, `components.json`) → consistent, accessible primitives.
- **Loading & feedback:** spinners and `sonner` toasts throughout checkout (`checkout/page.tsx`), `app/loading.tsx`, `ChunkErrorReloader.tsx`, `error.tsx`/`global-error.tsx`.
- **A11y basics:** `aria-invalid` on inputs, `role="alert"` on errors, labelled fields (`checkout/page.tsx:486-562`).
- **Mobile:** responsive utility classes, `MobileNav.tsx`, `max-w-*` containers.
- **Trust/SEO polish:** OG tags, JSON-LD, legal pages (`(legal)/*`), free-shipping messaging.

## Usability issues that can cause abandonment

| ID | Area | Issue | Evidence | Severity |
|---|---|---|---|---|
| UX-01 | Checkout | Forces sign-in before checkout — no guest option. Guest checkout is a top conversion lever in Indian D2C. | `checkout/page.tsx:79-84` | P1 |
| UX-02 | Checkout | Pays Cashfree **before** confirming the order can be placed; a stock race then shows a failure *after* money left the account. | `checkout/page.tsx:250-299` | P1 |
| UX-03 | Checkout header | Step header block is empty (title removed), leaving a bare progress bar with no "Checkout" heading at top. | `checkout/page.tsx:410-414` (empty divs) | P3 |
| UX-04 | PDP | No size chart, no reviews/ratings → lower confidence for apparel. | catalog gaps (`02`) | P1 |
| UX-05 | Cart | Max qty differs client (10) vs server (50); price changes after add aren't surfaced (only stock). | `cartStore.ts:41`, `revalidate-cart.ts` | P2 |
| UX-06 | Addresses | Only one saved address; no address book. | `saved-delivery.ts` | P2 |
| UX-07 | Shipping | Fail-open shipping silently shows "Free" when Shiprocket is down — customer may later be surprised, and store eats cost. | `recompute-pricing.ts:263-284` | P2 |
| UX-08 | Search | No typo tolerance; client-side filter won't scale and misses fuzzy matches. | `search-listed-products.ts` | P2 |
| UX-09 | Trust | No visible reviews, ratings, return-window badges, or delivery-date certainty on PDP. | — | P2 |
| UX-10 | Orders | No self-serve returns/exchange; cancellation is a request, not an action. | `cancellation.ts` | P1 |
| UX-11 | Empty/error states | Cart empty state exists; verify explore/search empty + network-error states across pages. | partial | P3 (Unverified) |

## Responsiveness / layout / accessibility (needs live verification)

- Tablet/desktop breakpoints present but **not visually verified** — run Lighthouse + manual device testing.
- Keyboard navigation: Radix gives focus management for dialogs/selects; full-page tab order **unverified**.
- Color contrast (orange-on-white brand) **unverified** against WCAG AA — check `globals.css` tokens.
- No evidence of skip-links, `lang` correctness beyond default, or form error summaries.

## Competitor UX reference (UNVERIFIED — verify before quoting)

| Capability | Amazon/Flipkart/Myntra typically offer | This store |
|---|---|---|
| Guest checkout / OTP login | Yes (phone OTP primary) | No (email/password/Google; no OTP) |
| Rich PDP (reviews, Q&A, size chart, try-on) | Yes | Minimal |
| Delivery date by PIN at PDP | Yes | At checkout only, fail-open |
| Saved address book | Yes | Single address |
| Returns/exchange self-serve | Yes | Missing |
| Recommendations / "frequently bought" | Yes | Related-by-category only |
| Wishlist cross-device | Yes | Yes (merges on sign-in) |

## Recommended UX priorities (pre-launch)
1. Add guest checkout (or phone-OTP) — UX-01.
2. Reorder checkout so order feasibility is confirmed before/with capture, and auto-refund on failure — UX-02.
3. Add size chart + basic reviews on PDP — UX-04/09.
4. Make shipping fail-closed or clearly flagged — UX-07.
5. Self-serve cancellation within allowed window + returns — UX-10.
