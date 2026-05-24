/**
 * Short shareable codes for (product, color) pairs.
 *
 * Each colorway of a product gets a deterministic 5-character code drawn
 * from a 31-symbol alphanumeric alphabet (uppercase letters + digits,
 * with the look-alikes I/O/L/0/1 removed so cashiers can read them off a
 * sticker or repeat them over the phone without confusion).
 *
 * The code is computed from `productId + ":" + canonicalColor` via FNV-1a,
 * which has two important properties for us:
 *
 *   1. **Deterministic.** Reads never need to wait on a write — given the
 *      same inputs we always return the same code. This means a freshly
 *      created variant has a usable code immediately, and legacy products
 *      that haven't been re-saved yet are still searchable.
 *   2. **Cheap.** Pure JS, no Web Crypto, no async. Safe to call inside
 *      Firestore parsing loops.
 *
 * Collision math: 31^5 = 28.6M unique codes. By the birthday paradox the
 * 50/50 collision threshold lands around ~6,300 variant pairs, which is
 * comfortably above realistic catalog sizes for the store. If we ever
 * outgrow that, bump CODE_LENGTH to 6 (31^6 = 887M, threshold ~37k).
 */

/** Alphabet: 23 uppercase letters + 8 digits (I, O, L, 0, 1 omitted). */
export const VARIANT_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export const VARIANT_CODE_LENGTH = 5;

/** Validation regex for parsed/typed codes. */
export const VARIANT_CODE_RE = new RegExp(
  `^[${VARIANT_CODE_ALPHABET}]{${VARIANT_CODE_LENGTH}}$`
);

/**
 * Compute the deterministic 5-character code for `(productId, color)`.
 *
 * `color` is lowercased and trimmed before hashing so cosmetic edits to
 * casing/whitespace don't shift the code. Returns an empty string for
 * obviously bogus inputs so callers can fall back gracefully.
 */
export function generateVariantCode(
  productId: string,
  color: string | null | undefined
): string {
  const id = (productId ?? "").trim();
  const col = (color ?? "").trim().toLowerCase();
  if (!id) return "";

  const input = `${id}:${col}`;
  // FNV-1a 32-bit — small, well-mixed, deterministic across JS runtimes.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }

  // Drain the 32-bit hash into base-31 digits. We re-seed with a small
  // permutation of the original hash if we somehow exhaust it (extremely
  // unlikely at length 5, but cheap insurance).
  let h = hash;
  let out = "";
  for (let i = 0; i < VARIANT_CODE_LENGTH; i++) {
    out += VARIANT_CODE_ALPHABET[h % VARIANT_CODE_ALPHABET.length];
    h = Math.floor(h / VARIANT_CODE_ALPHABET.length);
    if (h === 0) {
      h = (hash ^ (i + 1) * 0x9e3779b1) >>> 0;
    }
  }
  return out;
}

/** Normalize whatever the user typed into the canonical code form. */
export function normalizeVariantCode(raw: string | null | undefined): string {
  if (!raw) return "";
  // Uppercase, strip whitespace and any chars not in our alphabet.
  const cleaned = raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .split("")
    .filter((c) => VARIANT_CODE_ALPHABET.includes(c))
    .join("");
  return cleaned;
}

/** True when the string is exactly a well-formed code (post-normalize). */
export function isVariantCode(raw: string | null | undefined): boolean {
  const v = normalizeVariantCode(raw);
  return VARIANT_CODE_RE.test(v);
}
