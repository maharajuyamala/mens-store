import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AdminNotConfiguredError,
  requireAdminAuth,
  requireAdminFirestore,
} from "@/lib/server/firebase-admin";
import { guardWriteRequest } from "@/lib/api/security";
import { bootstrapSuperAdminEmails, roleGrantsAdminShell } from "@/lib/auth/roles";
import {
  GeminiBillingError,
  GeminiNotConfiguredError,
  GeminiQuotaError,
  generateModelImage,
} from "@/lib/server/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Image generation can take 10-30s; allow a generous server timeout.
export const maxDuration = 60;

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

const bodySchema = z
  .object({
    // Either send base64 (new local photos) ...
    image: z.string().min(16).max(15_000_000).optional(),
    mimeType: z.enum(ALLOWED_MIME).optional(),
    // ... or a URL to an already-uploaded photo (fetched server-side to dodge
    // browser CORS on Firebase Storage download URLs).
    imageUrl: z.string().url().max(2000).optional(),
    subject: z.enum(["man", "woman", "boy", "girl"]),
    extra: z.string().max(400).optional(),
    itemSelection: z.string().max(40).optional(),
  })
  .refine((v) => Boolean(v.imageUrl) || (Boolean(v.image) && Boolean(v.mimeType)), {
    message: "Provide either imageUrl or image + mimeType.",
  });

function stripDataUrl(input: string): string {
  const comma = input.indexOf(",");
  if (input.startsWith("data:") && comma !== -1) {
    return input.slice(comma + 1);
  }
  return input;
}

/** Only allow fetching from trusted image hosts (prevents SSRF). */
function isAllowedImageHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase();
    return (
      h === "firebasestorage.googleapis.com" ||
      h.endsWith(".googleapis.com") ||
      h.endsWith(".firebasestorage.app") ||
      h.endsWith(".appspot.com")
    );
  } catch {
    return false;
  }
}

/** Download a remote image into base64 + mime, server-side (no CORS). */
async function fetchRemoteImage(
  url: string
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not download the source image (${res.status}).`);
  }
  const contentType = (res.headers.get("content-type") || "").split(";")[0]!.trim();
  const mimeType = (ALLOWED_MIME as readonly string[]).includes(contentType)
    ? contentType
    : "image/jpeg";
  const buf = Buffer.from(await res.arrayBuffer());
  return { base64: buf.toString("base64"), mimeType };
}

export async function POST(request: Request) {
  const blocked = guardWriteRequest(request, {
    bucketName: "admin-generate-image",
    limit: 20,
    windowMs: 60_000,
  });
  if (blocked) return blocked;

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch (e) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: e instanceof Error ? e.message : "bad body",
      },
      { status: 400 }
    );
  }

  let adminAuth, db;
  try {
    adminAuth = requireAdminAuth();
    db = requireAdminFirestore();
  } catch (e) {
    if (e instanceof AdminNotConfiguredError) {
      return NextResponse.json(
        { error: "server_not_configured", message: e.message },
        { status: 503 }
      );
    }
    throw e;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "auth_required", message: "Sign in as an admin." },
      { status: 401 }
    );
  }

  let callerUid: string;
  let callerEmail: string | null = null;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice(7));
    callerUid = decoded.uid;
    callerEmail = decoded.email ?? null;
  } catch {
    return NextResponse.json(
      { error: "invalid_token", message: "Bad token." },
      { status: 401 }
    );
  }

  const callerSnap = await db.collection("users").doc(callerUid).get();
  const storedRole =
    callerSnap.exists && typeof callerSnap.data()?.role === "string"
      ? (callerSnap.data()!.role as string)
      : null;
  const email = callerEmail?.trim().toLowerCase();
  const isAdmin =
    roleGrantsAdminShell(storedRole) ||
    (email ? bootstrapSuperAdminEmails().has(email) : false);
  if (!isAdmin) {
    return NextResponse.json(
      { error: "forbidden", message: "Admin role required." },
      { status: 403 }
    );
  }

  // Resolve the source image: a remote URL (fetched here) or inline base64.
  let sourceBase64: string;
  let sourceMimeType: string;
  if (parsed.imageUrl) {
    if (!isAllowedImageHost(parsed.imageUrl)) {
      return NextResponse.json(
        { error: "invalid_request", message: "Image host not allowed." },
        { status: 400 }
      );
    }
    try {
      const fetched = await fetchRemoteImage(parsed.imageUrl);
      sourceBase64 = fetched.base64;
      sourceMimeType = fetched.mimeType;
    } catch (e) {
      return NextResponse.json(
        {
          error: "source_fetch_failed",
          message:
            e instanceof Error ? e.message : "Could not load the source photo.",
        },
        { status: 502 }
      );
    }
  } else {
    sourceBase64 = stripDataUrl(parsed.image!);
    sourceMimeType = parsed.mimeType!;
  }

  try {
    const result = await generateModelImage({
      sourceBase64,
      sourceMimeType,
      subject: parsed.subject,
      extra: parsed.extra,
      itemSelection: parsed.itemSelection,
    });
    return NextResponse.json({
      ok: true,
      image: `data:${result.mimeType};base64,${result.base64}`,
      mimeType: result.mimeType,
    });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json(
        { error: "ai_not_configured", message: e.message },
        { status: 503 }
      );
    }
    if (e instanceof GeminiQuotaError) {
      return NextResponse.json(
        { error: "quota_exceeded", message: e.message },
        { status: 429 }
      );
    }
    if (e instanceof GeminiBillingError) {
      return NextResponse.json(
        { error: "billing_blocked", message: e.message },
        { status: 402 }
      );
    }
    return NextResponse.json(
      {
        error: "generation_failed",
        message:
          e instanceof Error ? e.message : "Image generation failed. Try again.",
      },
      { status: 502 }
    );
  }
}
