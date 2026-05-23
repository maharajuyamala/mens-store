export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

/** Pre-compression hard cap to prevent runaway uploads of huge originals (camera RAW etc.). */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type ImageValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateImageFile(file: File): ImageValidationResult {
  if (!file) return { ok: false, reason: "No file selected." };
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    return {
      ok: false,
      reason: `${file.name}: only JPG, PNG, WebP, AVIF images are allowed (got ${file.type || "unknown type"}).`,
    };
  }
  if (file.size <= 0) {
    return { ok: false, reason: `${file.name} is empty.` };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `${file.name} is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`,
    };
  }
  return { ok: true };
}

/** Random-safe storage path for an uploaded image. */
export function buildImageStoragePath(file: File, folder = "products"): string {
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^a-z0-9]/g, "")
    : "bin";
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${folder}/${id}.${ext || "bin"}`;
}
