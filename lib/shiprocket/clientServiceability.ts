export type ServiceabilityResult = {
  serviceable: boolean;
  /** Set when Shiprocket itself was unreachable — UI may choose to allow proceeding. */
  failOpen?: boolean;
  error?: string;
};

/**
 * Asks /api/shiprocket/serviceability whether the given pincode is deliverable.
 * Resolves with `failOpen: true` when the API is down so the caller can decide
 * whether to block checkout or let the order through.
 */
export async function checkPincodeServiceable(
  deliveryPincode: string,
  options: { cod?: boolean; weightKg?: number } = {}
): Promise<ServiceabilityResult> {
  const pickupPincode =
    process.env.NEXT_PUBLIC_SHIPROCKET_PICKUP_PINCODE?.trim() ||
    // Fallback so the route can still answer when env is unset — Shiprocket
    // serviceability check works with any valid pickup PIN as the origin.
    "500055";

  try {
    const res = await fetch("/api/shiprocket/serviceability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pickupPincode,
        deliveryPincode,
        weightKg: options.weightKg ?? 0.5,
        cod: options.cod ?? true,
      }),
    });
    const json = (await res.json().catch(() => null)) as
      | { ok: boolean; serviceable: boolean; failOpen?: boolean; error?: string }
      | null;
    if (!json) {
      return { serviceable: true, failOpen: true, error: "no response" };
    }
    return {
      serviceable: !!json.serviceable,
      failOpen: !!json.failOpen,
      error: json.error,
    };
  } catch (e) {
    return {
      serviceable: true,
      failOpen: true,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}
