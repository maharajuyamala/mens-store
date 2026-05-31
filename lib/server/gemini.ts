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
 * Build the editing prompt. Mirrors the admin's manual prompt: dress an Indian
 * model in the supplied garment, smiling, on a clean studio background, framed
 * as a square (1:1) product shot.
 */
export function buildModelPrompt(subject: ModelSubject, extra?: string): string {
  const person = SUBJECT_PHRASE[subject];
  const base = [
    `Take the clothing item shown in the provided image and show it being worn by ${person}.`,
    "Keep the garment's exact colour, pattern, fabric texture, print and design unchanged — only place it on the model.",
    "The model should be standing in a natural full or three-quarter pose, smiling warmly and looking at the camera.",
    "Use a clean, softly-lit studio background (light neutral/grey) with professional e-commerce fashion lighting.",
    "Produce a sharp, high-resolution square (1:1) image suitable for an online clothing store product photo.",
  ];
  if (extra && extra.trim()) {
    base.push(`Additional instructions: ${extra.trim()}.`);
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
}): Promise<GeneratedImage> {
  const ai = getClient();
  const model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: buildModelPrompt(params.subject, params.extra) },
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
