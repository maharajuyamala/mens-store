/**
 * Color variants — one product, many colorways. Each variant carries its own
 * set of image URLs so the detail page can swap the gallery when the customer
 * picks a color.
 *
 * Stored on the product doc as:
 *   colorVariants: [
 *     { color: "wine",  label: "Wine",  hex: "#722F37", images: [url, url] },
 *     { color: "navy",  label: "Navy",  hex: "#001F3F", images: [url, url] }
 *   ]
 *
 * Backward compat: we also keep the legacy fields in lockstep —
 *   colors: ["wine", "navy"]          // for old filters
 *   images: [...all variant images]   // for card / explore code that doesn't know about variants
 *   image:  first variant's first image (cover)
 */

export type ColorVariant = {
  /** Canonical lowercase id used in cart / orders. */
  color: string;
  /** Optional human-readable label ("Wine red", "Sky blue"). Falls back to color. */
  label?: string;
  /** Optional hex preview (e.g. "#722F37"). UI falls back to swatch heuristics. */
  hex?: string;
  /** Ordered image URLs for this colorway. First = card cover for this color. */
  images: string[];
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((s) => s.length > 0);
}

/** Read variants off a raw Firestore doc; returns [] when the field is missing/empty. */
export function parseColorVariants(
  data: Record<string, unknown>
): ColorVariant[] {
  const raw = data.colorVariants;
  if (!Array.isArray(raw)) return [];
  const out: ColorVariant[] = [];
  const seen = new Set<string>();
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const colorRaw =
      typeof r.color === "string"
        ? r.color
        : typeof r.value === "string"
          ? r.value
          : typeof r.name === "string"
            ? r.name
            : "";
    const color = colorRaw.trim().toLowerCase();
    if (!color || seen.has(color)) continue;
    const images = asStringArray(r.images);
    if (images.length === 0) continue;
    const label =
      typeof r.label === "string" && r.label.trim().length > 0
        ? r.label.trim()
        : undefined;
    const hex =
      typeof r.hex === "string" && /^#?[0-9a-f]{3,8}$/i.test(r.hex)
        ? r.hex.startsWith("#")
          ? r.hex
          : `#${r.hex}`
        : undefined;
    seen.add(color);
    out.push({ color, label, hex, images });
  }
  return out;
}

/**
 * Pick the gallery to show for a selected color. Falls back to product images
 * when the variant is missing or has no images yet.
 */
export function imagesForColor(
  variants: ColorVariant[],
  color: string | null | undefined,
  fallback: string[]
): string[] {
  if (color) {
    const match = variants.find(
      (v) => v.color.toLowerCase() === color.toLowerCase()
    );
    if (match && match.images.length > 0) return match.images;
  }
  if (variants.length > 0 && variants[0]!.images.length > 0) {
    return variants[0]!.images;
  }
  return fallback;
}

/** Flat list of all variant images, ordered by variant then by image index. */
export function flattenVariantImages(variants: ColorVariant[]): string[] {
  const out: string[] = [];
  for (const v of variants) {
    for (const img of v.images) {
      if (img && !out.includes(img)) out.push(img);
    }
  }
  return out;
}

/** Pretty label for a variant — uses `label` when given, else title-cased color. */
export function variantLabel(v: Pick<ColorVariant, "color" | "label">): string {
  if (v.label && v.label.trim()) return v.label.trim();
  return v.color
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Strip Firestore-unfriendly fields when writing a variant doc:
 * drop empty optional strings and ensure `images` is a clean string array.
 */
export function sanitizeVariantForWrite(v: ColorVariant): ColorVariant {
  const out: ColorVariant = {
    color: v.color.trim().toLowerCase(),
    images: v.images.filter((s) => typeof s === "string" && s.length > 0),
  };
  if (v.label && v.label.trim()) out.label = v.label.trim();
  if (v.hex && v.hex.trim()) out.hex = v.hex.trim();
  return out;
}
