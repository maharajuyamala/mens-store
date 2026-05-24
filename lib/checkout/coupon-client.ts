import { getFirebaseAuth } from "@/app/firebase";

export type CouponValidateRequest = {
  code: string;
  subtotal: number;
};

export type CouponValidateOk = {
  ok: true;
  code: string;
  discount: number;
  type: "percent" | "amount";
  value: number;
  maxDiscount: number | null;
  expiresAt: string | null;
  newCustomerOnly: boolean;
  oncePerCustomer: boolean;
};

export type CouponValidateErr = {
  ok: false;
  error: string;
  message: string;
};

/**
 * Ask the server to validate a coupon for the current user + cart subtotal.
 * Sends the Firebase ID token when available so the server can run
 * per-user eligibility checks (new-customer, once-per-customer).
 */
export async function validateCouponClient(
  body: CouponValidateRequest
): Promise<CouponValidateOk | CouponValidateErr> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  try {
    const auth = getFirebaseAuth();
    const u = auth.currentUser;
    if (u) {
      const token = await u.getIdToken();
      headers.authorization = `Bearer ${token}`;
    }
  } catch {
    // Anonymous fall-through; server will treat as guest.
  }
  const res = await fetch("/api/coupons/validate", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      error: "network",
      message: "Could not verify coupon. Try again.",
    };
  }
  if (
    data &&
    typeof data === "object" &&
    "ok" in (data as Record<string, unknown>)
  ) {
    return data as CouponValidateOk | CouponValidateErr;
  }
  return {
    ok: false,
    error: "network",
    message: "Could not verify coupon. Try again.",
  };
}
