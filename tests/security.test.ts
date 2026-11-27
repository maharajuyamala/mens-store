import { describe, it, expect, beforeAll } from "vitest";
import { isAllowedOrigin } from "@/lib/api/security";

function req(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/x", { headers });
}

beforeAll(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
});

describe("isAllowedOrigin", () => {
  it("allows same-origin / SSR calls with no Origin or Referer", () => {
    expect(isAllowedOrigin(req({}))).toBe(true);
  });
  it("allows the configured site origin", () => {
    expect(isAllowedOrigin(req({ origin: "https://example.com" }))).toBe(true);
  });
  it("allows the www/apex counterpart", () => {
    expect(isAllowedOrigin(req({ origin: "https://www.example.com" }))).toBe(true);
  });
  it("allows vercel preview deploys", () => {
    expect(isAllowedOrigin(req({ origin: "https://my-branch-abc123.vercel.app" }))).toBe(true);
  });
  it("rejects an unrelated origin", () => {
    expect(isAllowedOrigin(req({ origin: "https://evil.example.net" }))).toBe(false);
  });
});
