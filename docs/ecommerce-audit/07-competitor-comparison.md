# 07 — Competitor Feature Matrix

**Important:** Competitor columns reflect commonly-known capabilities and are **UNVERIFIED** here (no live competitor testing was done). Treat them as directional. "My Website" reflects this codebase as traced.

Business-importance key: **E** = Essential for launch · **G** = Important for growth · **O** = Optional · **X** = Enterprise-scale, not needed now.

| Feature | My Website | Amazon | Flipkart | Myntra | Importance | Gap |
|---|---|---|---|---|---|---|
| Phone OTP login / guest checkout | ❌ (email/Google only) | ✅ | ✅ | ✅ | **E** | Yes |
| Server-authoritative pricing | ⚠️ server ok, rules bypassable | ✅ | ✅ | ✅ | **E** | Yes (P0) |
| Payment webhook + reconciliation | ❌ | ✅ | ✅ | ✅ | **E** | Yes (P0) |
| Automated refunds | ❌ manual | ✅ | ✅ | ✅ | **E** | Yes |
| UPI / cards / netbanking / COD | ✅ via Cashfree | ✅ | ✅ | ✅ | **E** | No |
| Inventory reservation / oversell safety | ⚠️ partial | ✅ | ✅ | ✅ | **E** | Partial |
| Product reviews & ratings | ❌ | ✅ | ✅ | ✅ | **G** | Yes |
| Size charts / fit guidance | ❌ | ✅ | ✅ | ✅ (strong) | **G** (apparel) | Yes |
| Recommendations / cross-sell | ❌ related-only | ✅ | ✅ | ✅ | **G** | Yes |
| Returns & exchanges (self-serve) | ❌ | ✅ | ✅ | ✅ | **E** (apparel) | Yes |
| Order tracking (AWB) | ⚠️ link when present | ✅ | ✅ | ✅ | **E** | Partial |
| Address book (multiple) | ❌ single | ✅ | ✅ | ✅ | **G** | Yes |
| Wishlist (cross-device) | ✅ | ✅ | ✅ | ✅ | **G** | No |
| Search (typo-tolerant, server) | ❌ client filter | ✅ | ✅ | ✅ | **G** | Yes |
| Coupons / promotions | ⚠️ no global cap | ✅ | ✅ | ✅ | **G** | Partial |
| SMS / WhatsApp notifications | ❌ email-only | ✅ | ✅ | ✅ | **G** (India) | Yes |
| Abandoned-cart recovery | ❌ | ✅ | ✅ | ✅ | **G** | Yes |
| Analytics / conversion tracking | ❌ | ✅ | ✅ | ✅ | **E** (you can't improve what you don't measure) | Yes |
| SEO (JSON-LD, sitemap, OG) | ✅ good | ✅ | ✅ | ✅ | **G** | No |
| GST-compliant invoices | ✅ | ✅ | ✅ | ✅ | **E** (India) | No |
| Admin product/order/inventory | ✅ | N/A (seller tools) | N/A | N/A | **E** | No |
| Loyalty / rewards | ❌ | ✅ | ✅ | ✅ (Insider) | **O/X** | Defer |
| Marketplace / multi-seller | ❌ | ✅ | ✅ | ✅ | **X** | Not needed |
| Personalized home feed / ML ranking | ❌ | ✅ | ✅ | ✅ | **X** | Not needed now |
| Same-day / slot delivery | ❌ | ✅ | ✅ | ⚠️ | **X** | Not needed now |

## How to read this
- **Close the ❌/⚠️ marked E before launch** — these are table stakes (payments integrity, refunds, returns, guest/OTP, analytics, tracking).
- **G items** are the growth backlog (reviews, recommendations, size charts, WhatsApp, abandoned cart, server search).
- **X items** (marketplace, ML feed, loyalty, slotted delivery) are explicitly **out of scope** for a single-brand menswear store right now — do **not** build these to "match competitors."
