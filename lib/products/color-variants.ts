/**
 * Color variants — one product, many colorways. Each variant carries its own
 * set of image URLs and its own per-size stock map so the same model can be
 * stocked differently in each color.
 *
 * Stored on the product doc as:
 *   colorVariants: [
 *     { color: "wine", hex: "#722F37", images: [...], sizes: { M: 2, L: 1 } },
 *     { color: "navy", hex: "#001F3F", images: [...], sizes: { S: 0, M: 3 } }
 *   ]
 *
 * Backward compat: we also keep the legacy fields in lockstep —
 *   colors: ["wine", "navy"]          // for old filters
 *   images: [...all variant images]   // for card / explore code that doesn't know about variants
 *   image:  first variant's first image (cover)
 *   sizes:  union of variant sizes    // legacy single-map readers still work
 *   stock:  sum of all variant stock  // legacy aggregate readers still work
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
  /** Per-size stock map for this color (e.g. `{ M: 2, L: 1 }`). Empty when not tracked per size. */
  sizes: Record<string, number>;
};

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === "string" ? x : ""))
    .filter((s) => s.length > 0);
}

/**
 * Parse a per-size map of stock counts. Accepts either:
 *   { M: 2, L: 1 }   — the modern shape used by the variant editor
 *   [{ M: 2, L: 1 }] — the legacy nested-array shape used by some early docs
 * Values are coerced to non-negative integers; bogus entries are dropped.
 */
function parseSizesMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === "object" && !Array.isArray(v)) {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const key = String(k).trim();
      if (!key) continue;
      const n = typeof val === "number" ? val : Number(val);
      if (!Number.isFinite(n)) continue;
      out[key] = Math.max(0, Math.floor(n));
    }
    return out;
  }
  if (Array.isArray(v) && v[0] && typeof v[0] === "object" && !Array.isArray(v[0])) {
    return parseSizesMap(v[0] as Record<string, unknown>);
  }
  return out;
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
    // `sizes` may be on the variant itself, or on the legacy `size` field —
    // we accept both so docs migrated from the flat shape still keep stock.
    const sizes = parseSizesMap(r.sizes ?? r.size);
    seen.add(color);
    out.push({ color, label, hex, images, sizes });
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
 * drop empty optional strings, ensure `images` is a clean string array,
 * coerce stock values to non-negative integers.
 */
export function sanitizeVariantForWrite(v: ColorVariant): ColorVariant {
  const sizes: Record<string, number> = {};
  for (const [k, val] of Object.entries(v.sizes ?? {})) {
    const key = String(k).trim();
    if (!key) continue;
    const n = typeof val === "number" ? val : Number(val);
    if (!Number.isFinite(n)) continue;
    sizes[key] = Math.max(0, Math.floor(n));
  }
  const out: ColorVariant = {
    color: v.color.trim().toLowerCase(),
    images: v.images.filter((s) => typeof s === "string" && s.length > 0),
    sizes,
  };
  if (v.label && v.label.trim()) out.label = v.label.trim();
  if (v.hex && v.hex.trim()) out.hex = v.hex.trim();
  return out;
}

// ─── Stock helpers ────────────────────────────────────────────────────────────

/** Union of every variant's size map (sums per-size stock across colors). */
export function unionVariantSizes(
  variants: readonly ColorVariant[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of variants) {
    for (const [size, qty] of Object.entries(v.sizes ?? {})) {
      out[size] = (out[size] ?? 0) + (Number(qty) || 0);
    }
  }
  return out;
}

/** Sum of all stock across every variant + size. */
export function totalStockFromVariants(
  variants: readonly ColorVariant[]
): number {
  let total = 0;
  for (const v of variants) {
    for (const qty of Object.values(v.sizes ?? {})) {
      total += Math.max(0, Math.floor(Number(qty) || 0));
    }
  }
  return total;
}

/** Per-size stock map for one color. Returns {} when the color isn't tracked. */
export function sizesForColor(
  variants: readonly ColorVariant[],
  color: string | null | undefined
): Record<string, number> {
  if (!color) return {};
  const v = variants.find((x) => x.color.toLowerCase() === color.toLowerCase());
  return v ? { ...v.sizes } : {};
}

/** Lookup stock for a specific (color, size). 0 when missing or out of stock. */
export function stockForColorSize(
  variants: readonly ColorVariant[],
  color: string | null | undefined,
  size: string | null | undefined
): number {
  if (!color || !size) return 0;
  const v = variants.find((x) => x.color.toLowerCase() === color.toLowerCase());
  if (!v) return 0;
  const n = v.sizes?.[size];
  return typeof n === "number" && Number.isFinite(n)
    ? Math.max(0, Math.floor(n))
    : 0;
}

/** True when at least one variant + size combination has stock > 0. */
export function hasAnyVariantStock(
  variants: readonly ColorVariant[]
): boolean {
  for (const v of variants) {
    for (const qty of Object.values(v.sizes ?? {})) {
      if ((Number(qty) || 0) > 0) return true;
    }
  }
  return false;
}
