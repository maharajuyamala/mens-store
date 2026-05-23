import "server-only";
import Razorpay from "razorpay";
import { createHmac } from "crypto";

export class RazorpayNotConfiguredError extends Error {
  constructor() {
    super("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
    this.name = "RazorpayNotConfiguredError";
  }
}

let cached: Razorpay | null | undefined;

export function getRazorpay(): Razorpay {
  if (cached === undefined) {
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;
    if (!key_id || !key_secret) {
      cached = null;
    } else {
      cached = new Razorpay({ key_id, key_secret });
    }
  }
  if (!cached) throw new RazorpayNotConfiguredError();
  return cached;
}

/** Razorpay's documented HMAC-SHA256 signature check: hex(hmac(key_secret, "{orderId}|{paymentId}")). */
export function verifyRazorpaySignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new RazorpayNotConfiguredError();
  const expected = createHmac("sha256", secret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest("hex");
  // Constant-time compare.
  if (expected.length !== input.signature.length) return false;
  let ok = 0;
  for (let i = 0; i < expected.length; i++) {
    ok |= expected.charCodeAt(i) ^ input.signature.charCodeAt(i);
  }
  return ok === 0;
}
