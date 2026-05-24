"use client";

import { getFirebaseAuth } from "@/app/firebase";

export type SignedReceipt = {
  /** Absolute URL (origin + path), ready to share. */
  url: string;
  /** Relative path, useful for `<Link href>`. */
  path: string;
  expiresAt: number;
};

/**
 * Ask the server to mint a fresh 30-day receipt link for the given order.
 * Requires the caller to be signed in as an admin (rules enforced on the
 * server side via the user's Firestore role).
 */
export async function fetchSignedReceipt(orderId: string): Promise<SignedReceipt> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in required to mint receipt links.");
  const idToken = await user.getIdToken();

  const res = await fetch("/api/receipts/sign", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ orderId }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    path?: string;
    expiresAt?: number;
    message?: string;
  };
  if (!res.ok || !json.ok || !json.path || !json.expiresAt) {
    throw new Error(json.message ?? "Could not generate receipt link.");
  }
  return {
    url: `${window.location.origin}${json.path}`,
    path: json.path,
    expiresAt: json.expiresAt,
  };
}
