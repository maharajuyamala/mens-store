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

export async function createAdhocOrder(
  payload: ShiprocketAdhocOrderPayload
): Promise<ShiprocketCreateOrderResponse> {
  return request<ShiprocketCreateOrderResponse>("/orders/create/adhoc", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
