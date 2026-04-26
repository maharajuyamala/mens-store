import type {
  ShiprocketAdhocOrderPayload,
  ShiprocketCreateOrderResponse,
  ShiprocketLoginResponse,
} from "@/lib/shiprocket/types";

const BASE = "https://apiv2.shiprocket.in/v1/external";

type CachedToken = { token: string; expiresAt: number };
let cached: CachedToken | null = null;

export class ShiprocketError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = "ShiprocketError";
    this.status = status;
    this.body = body;
  }
}

function readCreds(): { email: string; password: string } {
  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;
  if (!email || !password) {
    throw new ShiprocketError(
      "Shiprocket credentials missing. Set SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD.",
      500,
      null
    );
  }
  return { email, password };
}

async function login(): Promise<string> {
  const { email, password } = readCreds();
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as
    | ShiprocketLoginResponse
    | { message?: string }
    | null;
  if (!res.ok || !json || !("token" in json) || !json.token) {
    const message =
      (json && "message" in json && json.message) || "Shiprocket login failed";
    throw new ShiprocketError(message, res.status, json);
  }
  return json.token;
}

async function getToken(force = false): Promise<string> {
  const now = Date.now();
  if (!force && cached && cached.expiresAt > now + 60_000) {
    return cached.token;
  }
  const token = await login();
  // Shiprocket tokens last ~10 days; refresh after 8 to be safe.
  cached = { token, expiresAt: now + 8 * 24 * 60 * 60 * 1000 };
  return token;
}

async function request<T>(
  path: string,
  init: RequestInit & { retried?: boolean } = {}
): Promise<T> {
  const token = await getToken(init.retried === true);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: "no-store",
  });

  if (res.status === 401 && !init.retried) {
    cached = null;
    return request<T>(path, { ...init, retried: true });
  }

  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) {
    const message =
      (json && typeof json === "object" && "message" in json
        ? String((json as { message?: unknown }).message)
        : null) || `Shiprocket request failed (${res.status})`;
    throw new ShiprocketError(message, res.status, json);
  }
  return json as T;
}

function describeShiprocketBody(body: unknown): string {
  if (!body || typeof body !== "object") return "Empty Shiprocket response";
  const obj = body as Record<string, unknown>;
  // Validation errors: { errors: { field: [..] } } or { message: "..." }
  if (obj.errors && typeof obj.errors === "object") {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(obj.errors as Record<string, unknown>)) {
      if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
      else parts.push(`${k}: ${String(v)}`);
    }
    if (parts.length) return parts.join(" | ");
  }
  if (typeof obj.message === "string" && obj.message) return obj.message;
  if (typeof obj.error === "string" && obj.error) return obj.error;
  try {
    return JSON.stringify(body).slice(0, 400);
  } catch {
    return "Unknown Shiprocket response";
  }
}

export async function createAdhocOrder(
  payload: ShiprocketAdhocOrderPayload
): Promise<ShiprocketCreateOrderResponse> {
  const result = await request<ShiprocketCreateOrderResponse>(
    "/orders/create/adhoc",
    { method: "POST", body: JSON.stringify(payload) }
  );

  // Shiprocket returns 200 even for validation failures — verify the success shape.
  if (
    !result ||
    typeof result.order_id !== "number" ||
    typeof result.shipment_id !== "number"
  ) {
    console.error("[shiprocket] adhoc order body did not contain order_id/shipment_id", result);
    throw new ShiprocketError(
      describeShiprocketBody(result),
      200,
      result
    );
  }
  return result;
}
