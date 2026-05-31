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

function getClient(): GoogleGenAI {
  if (cachedClient === undefined) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    cachedClient = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }
  if (!cachedClient) throw new GeminiNotConfiguredError();
  return cachedClient;
}

const SUBJECT_PHRASE: Record<ModelSubject, string> = {
  man: "a handsome young adult Indian man",
  woman: "a beautiful young adult Indian woman",
  boy: "a cute Indian boy (child model)",
  girl: "a cute Indian girl (child model)",
};

/**
 * How the shot is framed, driven by the product's item selection so the model
 * photo highlights the right part of the body:
 *  - Set / One Piece → full length, head to feet
 *  - Top → upper body (the top/shirt is the hero)
 *  - Bottom → lower body (the pants/skirt is the hero)
 *  - Footwear → feet/shoes close-up
 *  - else → balanced three-quarter shot
 */
function framingInstruction(itemSelection?: string): string {
  switch ((itemSelection ?? "").trim().toLowerCase()) {
    case "set":
    case "one piece":
      return "Frame a full-length shot showing the entire model from the top of the head down to the feet, so the complete outfit is visible.";
    case "top":
    case "innerwear":
      return "Frame the upper body as the hero: crop roughly from the head to the hips/upper thigh so the top garment is large and clearly visible. Keep both arms and shoulders in frame.";
    case "bottom":
      return "Frame the lower body as the hero: crop roughly from the waist down to the feet so the bottom garment (pants/skirt) is large and clearly visible.";
    case "footwear":
      return "Frame a close, lower-body shot from the knees to the feet so the footwear is the clear focus.";
    case "accessories":
      return "Frame the shot so the accessory is worn and prominently visible, close enough to show its detail.";
    default:
      return "Frame a natural three-quarter shot from the head to mid-thigh.";
  }
}

/**
 * Build the editing prompt. Mirrors the admin's manual prompt: dress an Indian
 * model in the supplied garment, smiling, on a clean studio background, framed
 * as a square (1:1) product shot. Framing is tailored to the item selection.
 */
export function buildModelPrompt(
  subject: ModelSubject,
  opts?: { extra?: string; itemSelection?: string }
): string {
  const person = SUBJECT_PHRASE[subject];
  const base = [
    `Take the clothing item shown in the provided image and show it being worn by ${person}.`,
    "Keep the garment's exact colour, pattern, fabric texture, print and design unchanged — only place it on the model.",
    "The model should be standing in a natural pose, smiling warmly and looking at the camera.",
    framingInstruction(opts?.itemSelection),
    "Use a clean, softly-lit studio background (light neutral/grey) with professional e-commerce fashion lighting.",
    "Produce a sharp, high-resolution square (1:1) image suitable for an online clothing store product photo.",
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
