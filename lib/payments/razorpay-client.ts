/// <reference types="node" />

/**
 * Razorpay browser-side checkout helper. Loads the Razorpay JS SDK on demand,
 * creates a server-side order, opens the Checkout modal, and resolves with the
 * verified payment reference once the user pays.
 */

const SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (resp: unknown) => void) => void;
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay SDK only loads in the browser."));
  }
  if (window.Razorpay) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      sdkPromise = null;
      reject(new Error("Failed to load Razorpay SDK."));
    };
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export type RazorpayCheckoutInput = {
  items: Array<{
    productId: string;
    quantity: number;
    size?: string;
    color?: string;
  }>;
  discount: number;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  /**
   * "full" (default) — collect the full order total online.
   * "advance" — collect only the COD prepayment amount; the rest is collected by courier.
   */
  mode?: "full" | "advance";
};

export type RazorpayCheckoutResult = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
};

export class RazorpayCheckoutError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "RazorpayCheckoutError";
  }
}

/**
 * End-to-end browser flow:
 *   1. POST /api/payments/razorpay/create-order to get a Razorpay order id + amount.
 *   2. Open Checkout, await the user's payment.
 *   3. POST /api/payments/razorpay/verify with the signature.
 * Resolves with the verified ids; rejects with RazorpayCheckoutError otherwise.
 */
export async function runRazorpayCheckout(
  input: RazorpayCheckoutInput
): Promise<RazorpayCheckoutResult> {
  const createRes = await fetch("/api/payments/razorpay/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: input.items,
      discount: input.discount,
      mode: input.mode ?? "full",
    }),
  });
  const createJson = (await createRes.json().catch(() => null)) as
    | {
        ok: true;
        razorpayOrderId: string;
        amount: number;
        currency: string;
        keyId: string;
      }
    | { error?: string; message?: string }
    | null;
  if (!createRes.ok || !createJson || !("ok" in createJson) || !createJson.ok) {
    const code =
      (createJson && "error" in createJson && createJson.error) ||
      "create_failed";
    const message =
      (createJson && "message" in createJson && createJson.message) ||
      "Could not start payment.";
    throw new RazorpayCheckoutError(code, message);
  }

  await loadSdk();
  const RazorpayCtor = window.Razorpay;
  if (!RazorpayCtor) throw new RazorpayCheckoutError("sdk_missing", "Razorpay SDK unavailable.");

  return new Promise((resolve, reject) => {
    const rzp = new RazorpayCtor({
      key: createJson.keyId,
      amount: createJson.amount,
      currency: createJson.currency,
      name: "SecondSkin",
      order_id: createJson.razorpayOrderId,
      prefill: {
        name: input.customer.name,
        email: input.customer.email,
        contact: input.customer.phone,
      },
      theme: { color: "#ea580c" },
      handler: async (resp: unknown) => {
        const r = resp as {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        };
        try {
          const verifyRes = await fetch("/api/payments/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpayOrderId: r.razorpay_order_id,
              razorpayPaymentId: r.razorpay_payment_id,
              razorpaySignature: r.razorpay_signature,
            }),
          });
          const verifyJson = (await verifyRes.json().catch(() => null)) as
            | { ok?: boolean; error?: string; message?: string }
            | null;
          if (!verifyRes.ok || !verifyJson?.ok) {
            const message =
              verifyJson?.message ?? "Payment verification failed.";
            reject(
              new RazorpayCheckoutError(
                verifyJson?.error ?? "verify_failed",
                message
              )
            );
            return;
          }
          resolve({
            razorpayOrderId: r.razorpay_order_id,
            razorpayPaymentId: r.razorpay_payment_id,
            razorpaySignature: r.razorpay_signature,
          });
        } catch (e) {
          reject(
            new RazorpayCheckoutError(
              "verify_network",
              e instanceof Error ? e.message : "Network error during verification."
            )
          );
        }
      },
      modal: {
        ondismiss: () => {
          reject(new RazorpayCheckoutError("dismissed", "Payment was cancelled."));
        },
      },
    });
    rzp.on("payment.failed", (resp: unknown) => {
      const r = resp as { error?: { description?: string } };
      reject(
        new RazorpayCheckoutError(
          "payment_failed",
          r?.error?.description ?? "Payment failed."
        )
      );
    });
    rzp.open();
  });
}
