import type { ImageLoaderProps } from "next/image";

/**
 * next/image custom loader for ImageKit-hosted images.
 *
 * Appends ImageKit's edge transformation params (`tr=w-<width>,q-<quality>,
 * f-auto`) so each responsive size is resized + re-encoded (WebP/AVIF) at
 * ImageKit's CDN edge — instead of round-tripping the full original through
 * the Vercel image optimizer. This is faster on first load and avoids Vercel
 * image-optimization usage.
 *
 * IMPORTANT: use `imageKitLoaderFor(src)` so the loader is applied ONLY to
 * ImageKit URLs. For any other host (Firebase Storage, Google avatars, data:
 * URLs) it returns undefined and next/image keeps its default optimizer — so
 * there is no regression for non-ImageKit images.
 */

const IMAGEKIT_HOST = "ik.imagekit.io";

export function isImageKitUrl(src: string): boolean {
  return typeof src === "string" && src.includes(`://${IMAGEKIT_HOST}/`);
}

export function imagekitLoader({ src, width, quality }: ImageLoaderProps): string {
  if (!isImageKitUrl(src)) return src;
  const q = typeof quality === "number" && quality > 0 ? quality : 70;
  const trValue = `w-${width},q-${q},f-auto`;

  const [base, query] = src.split("?");
  if (!query) return `${base}?tr=${trValue}`;
  // Merge into an existing tr= if the URL already carries one; otherwise add it.
  if (/(^|&)tr=/.test(query)) {
    const merged = query.replace(
      /(^|&)tr=([^&]*)/,
      (_m, p1: string, existing: string) => `${p1}tr=${existing},${trValue}`
    );
    return `${base}?${merged}`;
  }
  return `${base}?${query}&tr=${trValue}`;
}

/**
 * Returns the ImageKit loader when `src` is an ImageKit URL, else undefined
 * (so next/image falls back to its default optimizer — no regression).
 */
export function imageKitLoaderFor(
  src: string
): ((p: ImageLoaderProps) => string) | undefined {
  return isImageKitUrl(src) ? imagekitLoader : undefined;
}
