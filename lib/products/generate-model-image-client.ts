import imageCompression from "browser-image-compression";
import { getFirebaseAuth } from "@/app/firebase";

export type ModelSubject = "man" | "woman" | "boy" | "girl";

export type GenerateModelImageOk = {
  ok: true;
  /** data: URL of the generated model photo. */
  image: string;
  mimeType: string;
};

export type GenerateModelImageErr = {
  ok: false;
  error: string;
  message: string;
};

// Keep the upload payload small & within allowed input MIME types: re-encode
// the source to JPEG, max ~1600px / ~1.5MB before base64-ing it for the API.
const SOURCE_COMPRESSION = {
  maxSizeMB: 1.5,
  maxWidthOrHeight: 1600,
  useWebWorker: true,
  fileType: "image/jpeg",
} as const;

function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/**
 * Send a plain garment photo to our server, which asks Gemini to render an
 * Indian model wearing it, and return the generated image as a data URL.
 */
export async function generateModelImageClient(params: {
  /** A freshly-picked local file (compressed + sent as base64). */
  source?: File;
  /** URL of an already-uploaded photo; fetched & processed server-side. */
  sourceUrl?: string;
  subject: ModelSubject;
  extra?: string;
  itemSelection?: string;
}): Promise<GenerateModelImageOk | GenerateModelImageErr> {
  // For new local files, compress + base64 here. For existing (already-uploaded)
  // photos we just forward the URL — the server downloads it (Firebase Storage
  // URLs aren't readable via browser fetch() due to CORS).
  let dataUrl: string | null = null;
  if (!params.sourceUrl) {
    if (!params.source) {
      return { ok: false, error: "read", message: "No source image provided." };
    }
    try {
      const compressed = await imageCompression(params.source, SOURCE_COMPRESSION);
      dataUrl = await fileToDataUrl(compressed);
    } catch {
      return {
        ok: false,
        error: "read",
        message: "Could not read that image. Try another photo.",
      };
    }
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  try {
    const u = getFirebaseAuth().currentUser;
    if (!u) {
      return {
        ok: false,
        error: "auth_required",
        message: "Please sign in again as an admin.",
      };
    }
    headers.authorization = `Bearer ${await u.getIdToken()}`;
  } catch {
    return {
      ok: false,
      error: "auth_required",
      message: "Please sign in again as an admin.",
    };
  }

  let res: Response;
  try {
    res = await fetch("/api/admin/products/generate-image", {
      method: "POST",
      headers,
      body: JSON.stringify(
        params.sourceUrl
          ? {
              imageUrl: params.sourceUrl,
              subject: params.subject,
              extra: params.extra,
              itemSelection: params.itemSelection,
            }
          : {
              image: dataUrl,
              mimeType: "image/jpeg",
              subject: params.subject,
              extra: params.extra,
              itemSelection: params.itemSelection,
            }
      ),
    });
  } catch {
    return { ok: false, error: "network", message: "Network error. Try again." };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: "network", message: "Bad server response. Try again." };
  }

  if (
    data &&
    typeof data === "object" &&
    (data as Record<string, unknown>).ok === true
  ) {
    return data as GenerateModelImageOk;
  }
  const err = (data ?? {}) as Record<string, unknown>;
  return {
    ok: false,
    error: typeof err.error === "string" ? err.error : "generation_failed",
    message:
      typeof err.message === "string"
        ? err.message
        : "Could not generate the image. Try again.",
  };
}

/** Convert a data: URL (e.g. the generated image) into a File for upload. */
export async function dataUrlToFile(
  dataUrl: string,
  filename: string
): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const type = blob.type || "image/png";
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  return new File([blob], `${filename}.${ext}`, { type });
}
