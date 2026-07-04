import "server-only";
import { GoogleGenAI } from "@google/genai";

/**
 * Server-side wrapper around Gemini 2.5 Flash Image ("Nano Banana"). Takes a
 * plain product/cloth photo and returns a new image of an Indian model wearing
 * it — the exact step admins used to do by hand in the Gemini / ChatGPT web UI.
 *
 * The key lives in GEMINI_API_KEY (server-only). Image generation is a paid
 * Gemini feature, so the key must belong to a billed Google Cloud project.
 */

export type ModelSubject = "man" | "woman" | "boy" | "girl";

const DEFAULT_MODEL = "gemini-2.5-flash-image";

let cachedClient: GoogleGenAI | null | undefined;

export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("Gemini is not configured. Set GEMINI_API_KEY.");
    this.name = "GeminiNotConfiguredError";
  }
}

/** Thrown when the API key's project is out of (or has zero) image quota. */
export class GeminiQuotaError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Gemini image quota exceeded. The free tier doesn't allow image generation — enable billing (pay-as-you-go) on your Google Cloud project, then try again."
    );
    this.name = "GeminiQuotaError";
  }
}

/** Thrown when Google blocks the API key (e.g. unpaid billing / dunning). */
export class GeminiBillingError extends Error {
  constructor(message?: string) {
    super(
      message ??
        "Google Cloud blocked this Gemini API key (403 PERMISSION_DENIED). Usually this means the linked billing account has an unpaid invoice or is suspended. Open https://console.cloud.google.com/billing, fix payment on the project that owns GEMINI_API_KEY, then try again."
    );
    this.name = "GeminiBillingError";
  }
}

/** Detect Google's 429 / RESOURCE_EXHAUSTED quota errors from the SDK. */
function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("\"code\":429") ||
    msg.includes("exceeded your current quota") ||
    /\blimit:\s*0\b/.test(msg)
  );
}

/** Detect Google's 403 PERMISSION_DENIED billing/dunning errors from the SDK. */
function isBillingError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    msg.includes("PERMISSION_DENIED") &&
    (msg.includes("dunning") ||
      msg.includes("billing") ||
      msg.includes("\"code\":403"))
  );
}

function getClient(): GoogleGenAI {
  if (cachedClient === undefined) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    cachedClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
  if (!cachedClient) throw new GeminiNotConfiguredError();
  return cachedClient;
}

const SUBJECT_PHRASE: Record<ModelSubject, string> = {
  man: "a handsome young adult Indian man with natural Indian features and fair, light (white) skin tone",
  woman: "a beautiful young adult Indian woman with natural Indian features and fair, light (white) skin tone",
  boy: "a cute Indian boy (child model) with natural Indian features and fair, light (white) skin tone",
  girl: "a cute Indian girl (child model) with natural Indian features and fair, light (white) skin tone",
};

/**
 * Boutique-scene archetypes that the model is placed inside. Every archetype is
 * a warm, sunlit interior/courtyard with real props (potted plants, wooden or
 * rattan furniture, heritage architecture) flanking the model symmetrically on
 * the LEFT and RIGHT of the frame — this is the "side-center person" look
 * from the admin's hand-picked reference shots. Gemini is asked to tint the
 * palette so the setting harmonises with the garment.
 */
const BOUTIQUE_SCENES = [
  "a warm cream-plastered boutique interior with tall potted snake plants in white ceramic planters on both sides of the model and soft window daylight — palette tuned to complement the garment's dominant colours",
  "a warm off-white lifestyle-boutique room with a small wooden console table and a leafy potted plant on one side and a tall wicker/rattan planter with green foliage on the other side, framed symmetrically around the model, in soft mid-morning natural light",
  "a heritage Indian courtyard with warm terracotta / sandstone walls, an arched niche or arched doorway behind, a clay/terracotta pot with green plant on one side and hanging planters with fresh greenery on the other side, in warm late-morning sunlight — palette tuned to complement the garment",
  "a cosy artisanal boutique corner with a warm-toned lime-washed wall, a wooden stool or low console with a small potted fern on one side and a large monstera / snake plant in a stoneware pot on the other side, softly lit by daylight through an unseen window",
];

function pickScene(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return BOUTIQUE_SCENES[hash % BOUTIQUE_SCENES.length]!;
}

/**
 * How the shot is framed, driven by the product's item selection so the model
 * photo highlights the right part of the body. In every case the *entire*
 * garment must be visible — no cropping that cuts off the hem, sleeves, or
 * waistband of the hero piece.
 */
function framingInstruction(itemSelection?: string): string {
  switch ((itemSelection ?? "").trim().toLowerCase()) {
    case "set":
    case "one piece":
      return "Frame a full-length shot from the top of the head down to below the feet, with a small margin of background above the head and below the shoes, so the COMPLETE outfit (top, bottom, footwear) is entirely visible inside the frame with nothing cropped.";
      case "top":
      case "innerwear":
        return "Frame the upper body so the ENTIRE top garment is visible: include the full collar/neckline, both full sleeves down to the cuffs, and the complete hem of the top (do not crop the bottom of the shirt). The crop should go from just above the head to slightly below the hem of the top garment. Both arms must be fully in frame.";
      case "bottom":
        return "Frame the lower body so the ENTIRE bottom garment is visible: include the full waistband at the top and the full hem/ankles down to and including the shoes at the bottom. Do not crop the waistband or the ankles. Show the bottom garment from waist to feet completely.";
    case "footwear":
      return "Frame a close lower-body shot from mid-calf to just below the shoes so the entire footwear is fully visible (toe to heel) and is the clear focus.";
    case "accessories":
      return "Frame the shot so the accessory is worn and entirely visible with all of its detail in frame, close enough to read its texture but not so close that any part is cropped.";
    default:
      return "Frame a full-length shot from head to feet so the entire outfit is visible with nothing cropped.";
  }
}

/**
 * Build the editing prompt: dress an Indian model in the supplied garment,
 * placed in a warm boutique / heritage-courtyard scene whose palette
 * harmonises with the garment, framed as a square (1:1) product shot with the
 * full hero garment always visible. The composition mirrors the admin's
 * hand-picked reference shots: model centered vertically, real props (plants,
 * wooden furniture, heritage arches) flanking symmetrically left and right.
 */
export function buildModelPrompt(
  subject: ModelSubject,
  opts?: { extra?: string; itemSelection?: string }
): string {
  const person = SUBJECT_PHRASE[subject];
  const scene = pickScene(
    `${subject}|${opts?.itemSelection ?? ""}|${opts?.extra ?? ""}|${Date.now()}`
  );
  const base = [
    `Take the clothing item shown in the provided image and show it being worn by ${person}.`,
    "Keep the garment's exact colour, pattern, fabric texture, print, stitching and design unchanged — only place it on the model. Do not redesign, recolour or restyle the garment.",
    "POSE: the model stands centered in the frame in a natural, relaxed lifestyle pose — a slight three-quarter body angle to the camera, weight shifted onto one leg, with one hand casually placed near the hair, the neckline, or on the hip, wearing a warm confident smile and looking directly into the camera. It must feel like a candid boutique / Instagram lifestyle portrait — NOT a stiff studio catalog pose. Skin, hair and proportions must look photo-realistic, like a real DSLR photograph (not illustrated, not AI-looking, no plastic skin).",
    framingInstruction(opts?.itemSelection),
    `SCENE: place the model inside ${scene}. The scene MUST include real, tactile props — potted plants, wooden or rattan furniture, ceramic/terracotta planters, or heritage architectural details — arranged SYMMETRICALLY so that something visually anchors both the LEFT AND the RIGHT of the model (for example a plant on one side and a small console or a second planter on the other), framing the person like a curated boutique portrait. Absolutely no plain studio backdrop, no empty seamless wall, no random street.`,
    "BACKGROUND PALETTE MUST HARMONISE WITH THE GARMENT: read the garment's dominant colours from the source image and tune the wall tone, plant pots, wood tones and any decor so the whole scene sits in the same warm tonal family as the outfit (e.g. terracotta / warm stone tones for red or ethnic-Indian garments, warm cream + fresh greenery for green or floral garments, warm off-white + wood + greenery for brown / earthy casuals, soft neutral cream for pastels). The background should feel intentionally styled around the outfit, not random.",
    "LIGHTING: warm, soft, natural mid-morning daylight coming from one side, with gentle realistic shadows on the ground behind and beside the model. Slight, tasteful depth-of-field — the flanking props remain clearly readable, NOT heavily blurred.",
    "Output a sharp, high-resolution SQUARE image with a strict 1:1 aspect ratio (equal width and height). The model is centered horizontally with a little breathing room on all sides, and the full hero garment must fit comfortably inside this square frame — do not crop the garment to fit.",
  ];
  if (opts?.extra && opts.extra.trim()) {
    base.push(`Additional instructions: ${opts.extra.trim()}.`);
  }
  return base.join(" ");
}

export type GeneratedImage = {
  /** Raw base64 (no data: prefix). */
  base64: string;
  mimeType: string;
};

/**
 * Generate a model-wearing image from a source garment image.
 * @param sourceBase64 raw base64 of the source image (no data URL prefix)
 * @param sourceMimeType e.g. "image/jpeg"
 */
export async function generateModelImage(params: {
  sourceBase64: string;
  sourceMimeType: string;
  subject: ModelSubject;
  extra?: string;
  itemSelection?: string;
}): Promise<GeneratedImage> {
  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;

  let response;
  try {
    response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            {
              text: buildModelPrompt(params.subject, {
                extra: params.extra,
                itemSelection: params.itemSelection,
              }),
            },
            {
              inlineData: {
                mimeType: params.sourceMimeType,
                data: params.sourceBase64,
              },
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (isQuotaError(err)) throw new GeminiQuotaError();
    if (isBillingError(err)) throw new GeminiBillingError();
    throw err;
  }

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    const inline = part.inlineData;
    if (inline?.data) {
      return {
        base64: inline.data,
        mimeType: inline.mimeType || "image/png",
      };
    }
  }

  // No image came back — surface any text Gemini returned (often a refusal or
  // a safety message) so the admin gets an actionable error.
  const textPart = parts.find((p) => typeof p.text === "string")?.text;
  throw new Error(
    textPart
      ? `Gemini did not return an image: ${textPart}`
      : "Gemini did not return an image. Try a different photo or subject."
  );
}
