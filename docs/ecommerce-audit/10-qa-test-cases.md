# 10 — QA Test Cases

Test cases to be automated (unit/integration via Vitest/Jest + firebase emulator; e2e via Playwright) and run in CI. **None are currently automated** (`package.json` has no `test` script). Priority tags map to the roadmap.

## Security / money-path regression (MUST pass before launch)

| ID | Case | Steps | Expected |
|---|---|---|---|
| QA-SEC-01 | Direct order create blocked | Using Firebase client SDK, attempt `addDoc(orders, {price-manipulated})` | PERMISSION_DENIED |
| QA-SEC-02 | Direct stock decrement blocked | Client SDK `updateDoc(products/x, {stock: 0})` | PERMISSION_DENIED |
| QA-SEC-03 | Payment amount binding | Create CF order ₹100, pay; call `orders/place` with a ₹10,000 cart + that cfPaymentId | 4xx `amount_mismatch` |
| QA-SEC-04 | Payment replay | Place order A with cfPaymentId; reuse same cfPaymentId for order B | 2nd fails `payment_already_used` |
| QA-SEC-05 | Captured-but-no-order reconciled | Simulate capture, no `place` call; run reconcile job | order created or auto-refund, alert raised |
| QA-SEC-06 | Coupon global cap | Redeem coupon up to cap+1 | last redemption rejected |
| QA-SEC-07 | Coupon once-per-customer via API (guest) | Call place as guest twice with once-per-customer coupon | 2nd rejected |
| QA-SEC-08 | Cross-user order read | User B reads User A order id | PERMISSION_DENIED |
| QA-SEC-09 | Admin endpoint authz | Non-admin bearer → `admin/users/role` | 403 |
| QA-SEC-10 | Origin/rate limit | 100 rapid `create-order` from one identity | throttled durably |

## Checkout & payments

| ID | Case | Expected |
|---|---|---|
| QA-PAY-01 | Online full payment happy path | order `paid`, stock decremented once |
| QA-PAY-02 | COD advance | advance captured, `balanceDue` correct, `partial` |
| QA-PAY-03 | Payment dismissed | no order, cart intact, toast |
| QA-PAY-04 | Payment fail then retry | exactly one order |
| QA-PAY-05 | Browser close post-capture | webhook creates order (idempotent) |
| QA-PAY-06 | Duplicate webhook delivery | single order, no double decrement |
| QA-PAY-07 | Price change mid-checkout | server re-prices; paid amount reconciled or re-auth required |
| QA-PAY-08 | Coupon expires mid-checkout | `place` rejects expired code |

## Inventory

| ID | Case | Expected |
|---|---|---|
| QA-INV-01 | Last item, 2 concurrent buyers | one succeeds, one `INSUFFICIENT_STOCK`, loser not charged (post-fix) |
| QA-INV-02 | Variant stock read | correct per color+size availability |
| QA-INV-03 | Cancel restores variant stock | exact variant restored once (idempotent) |
| QA-INV-04 | Oversell attempt | rejected |

## Orders

| ID | Case | Expected |
|---|---|---|
| QA-ORD-01 | Valid transitions | pending→processing→shipped→delivered allowed |
| QA-ORD-02 | Invalid transition | delivered→shipped rejected (rules + admin tx) |
| QA-ORD-03 | Cancel from delivered | allowed, restocks, refund triggered |
| QA-ORD-04 | Invoice/GST correctness | totals = subtotal−discount+shipping; GST breakdown matches |
| QA-ORD-05 | Order history scoping | user sees only own orders |

## Auth & accounts

| ID | Case | Expected |
|---|---|---|
| QA-AUTH-01 | Signup sends verification | email sent |
| QA-AUTH-02 | Unverified checkout blocked (post-fix) | blocked with prompt |
| QA-AUTH-03 | Reset password | email sent, reset works |
| QA-AUTH-04 | Role immutability by client | client cannot set own role (rules) |
| QA-AUTH-05 | Last super_admin demotion | blocked (`admin/users/role:128-144`) |

## Catalog / search / cart

| ID | Case | Expected |
|---|---|---|
| QA-CAT-01 | OOS product | not purchasable; JSON-LD OutOfStock |
| QA-CAT-02 | Archived product checkout | `UNLISTED_PRODUCT` |
| QA-SRCH-01 | Typo query (post-fix) | fuzzy match returns product |
| QA-CART-01 | Qty clamp | client/server max aligned |
| QA-CART-02 | Stale cart revalidation | OOS removed, qty clamped with notice |

## Admin

| ID | Case | Expected |
|---|---|---|
| QA-ADM-01 | Create product | appears listed |
| QA-ADM-02 | Update stock via scan | stock updated, audit logged (post-fix) |
| QA-ADM-03 | Process + ship order | status + AWB + email |
| QA-ADM-04 | CSV export | correct columns/rows |

## Non-functional (to measure, not asserted yet)
- Lighthouse LCP/INP/CLS budgets on home/PLP/PDP/checkout.
- Load test: 100/1k concurrent on PDP + checkout.
- a11y: axe clean on key pages; keyboard-only checkout.
