/**
 * Ambient module declaration for @cashfreepayments/cashfree-js — the package
 * ships without .d.ts files. We type only what we actually use in
 * lib/payments/cashfree-client.ts.
 *
 * Docs: https://www.cashfree.com/docs/payments/online/web/checkout
 */
declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";

  export interface CashfreeCheckoutOptions {
    paymentSessionId: string;
    /** "_self" (default) | "_blank" | "_modal" | "_top" */
    redirectTarget?: "_self" | "_blank" | "_modal" | "_top";
    returnUrl?: string;
  }

  export interface CashfreeCheckoutResult {
    /** Present when the modal closed WITHOUT a successful payment. */
    error?: {
      code?: string;
      message?: string;
    } | null;
    /** Present when redirect flow was used. */
    redirect?: boolean;
    /** Cashfree may put payment details here on success in some SDK versions. */
    paymentDetails?: Record<string, unknown>;
  }

  export interface CashfreeInstance {
    checkout(options: CashfreeCheckoutOptions): Promise<CashfreeCheckoutResult>;
  }

  export function load(options: { mode: CashfreeMode }): Promise<CashfreeInstance>;
}
