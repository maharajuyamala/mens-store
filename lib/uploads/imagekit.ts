"use client";

import { getFirebaseAuth } from "@/app/firebase";

const UPLOAD_ENDPOINT = "https://upload.imagekit.io/api/v1/files/upload";

type AuthResponse = {
  ok: true;
  token: string;
  expire: number;
  signature: string;
  publicKey: string | null;
};

type UploadResponse = {
  url: string;
  fileId: string;
  filePath: string;
  name: string;
  thumbnailUrl?: string;
};

export type ImageKitUploadResult = {
  url: string;
  fileId: string;
  filePath: string;
  name: string;
};

let cachedAuth: { token: string; expire: number; signature: string; publicKey: string } | null = null;

async function fetchAuth(): Promise<{
  token: string;
  expire: number;
  signature: string;
  publicKey: string;
}> {
  // Reuse the auth tuple while it still has at least 60s of life — avoids a
  // round-trip on every image in a multi-upload batch.
  const now = Math.floor(Date.now() / 1000);
  if (cachedAuth && cachedAuth.expire - 60 > now) {
    return cachedAuth;
  }

  const user = getFirebaseAuth().currentUser;
  if (!user) {
    throw new Error("Please sign in as an admin to upload images.");
  }
  const idToken = await user.getIdToken();

  const res = await fetch("/api/imagekit/auth", {
    method: "GET",
    headers: { authorization: `Bearer ${idToken}` },
    cache: "no-store",
  });
  if (!res.ok) {
    let message = `ImageKit auth failed (${res.status}).`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body?.message) message = body.message;
    } catch {}
    throw new Error(message);
  }
  const body = (await res.json()) as AuthResponse;
  const publicKey =
    body.publicKey ?? process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ?? "";
  if (!publicKey) {
    throw new Error(
      "NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY is not set — add it to .env.local and redeploy."
    );
  }
  cachedAuth = {
    token: body.token,
    expire: body.expire,
    signature: body.signature,
    publicKey,
  };
  return cachedAuth;
}

export type UploadOptions = {
  folder?: string;
  fileName?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

/**
 * Upload a file to ImageKit directly from the browser. The browser never
 * sees the private key — we fetch a short-lived signature from
 * /api/imagekit/auth (admin-only) and post the file straight to
 * upload.imagekit.io. Returns the public ImageKit URL.
 */
export async function uploadImageToImageKit(
  file: File,
  options: UploadOptions = {}
): Promise<ImageKitUploadResult> {
  const { folder = "products", fileName, onProgress, signal } = options;
  const { token, expire, signature, publicKey } = await fetchAuth();

  const form = new FormData();
  form.append("file", file);
  form.append("fileName", fileName ?? file.name);
  form.append("publicKey", publicKey);
  form.append("signature", signature);
  form.append("token", token);
  form.append("expire", String(expire));
  if (folder) form.append("folder", folder);
  form.append("useUniqueFileName", "true");

  return new Promise<ImageKitUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", UPLOAD_ENDPOINT);

    xhr.upload.onprogress = (ev) => {
      if (!onProgress || !ev.lengthComputable) return;
      onProgress((ev.loaded / ev.total) * 100);
    };

    xhr.onload = () => {
      // ImageKit returns 200 on success; any other status (incl. 4xx with a
      // signed-url mismatch) carries a JSON error body.
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as UploadResponse;
          onProgress?.(100);
          resolve({
            url: data.url,
            fileId: data.fileId,
            filePath: data.filePath,
            name: data.name,
          });
        } catch (e) {
          reject(
            new Error(
              `ImageKit returned a non-JSON success body: ${
                e instanceof Error ? e.message : String(e)
              }`
            )
          );
        }
        return;
      }
      let message = `ImageKit upload failed (${xhr.status}).`;
      try {
        const body = JSON.parse(xhr.responseText) as { message?: string };
        if (body?.message) {
          message = body.message;
          // Signed tokens can only be used once — if we hit a token reuse
          // error, drop the cache so the next upload re-signs.
          if (/token|signature|expire/i.test(message)) cachedAuth = null;
        }
      } catch {}
      reject(new Error(message));
    };

    xhr.onerror = () =>
      reject(new Error("Network error while uploading to ImageKit."));
    xhr.onabort = () => reject(new Error("Upload aborted."));

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
