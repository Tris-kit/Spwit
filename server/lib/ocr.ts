// Receipt OCR via Google Gemini, run server-side with the org's key. This is the
// production replacement for the app's on-device key path: the client sends a
// small base64 JPEG, we call the model, and return structured line items.
//
// Mirrors the app's recognizeReceiptGemini (src/ocr.ts) so results match.

import { ParsedReceipt } from "./types";

// Cheap, fast multimodal model — receipt OCR is high-volume and simple.
const MODEL = "gemini-3.5-flash-lite";

// Gemini's schema dialect: uppercase types, no additionalProperties.
const GEMINI_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          price: { type: "NUMBER" },
        },
        required: ["name", "price"],
      },
    },
    tax: { type: "NUMBER" },
    subtotal: { type: "NUMBER" },
    total: { type: "NUMBER" },
  },
  required: ["items", "tax", "subtotal", "total"],
} as const;

const PROMPT =
  "This is a photo of a restaurant receipt. Extract every ordered line item " +
  "with its individual line price as a number in dollars. Do NOT include " +
  "subtotal, tax, tip/gratuity, total, or payment lines as items. Report tax, " +
  "subtotal, and total separately — use 0 if a value isn't printed.";

export async function recognizeReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<ParsedReceipt> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mediaType, data: imageBase64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 400 && /api[\s_-]?key/i.test(body)) {
      throw new Error("Gemini API key was rejected.");
    }
    throw new Error(`Gemini OCR failed (${res.status}). ${body.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");

  const parsed = JSON.parse(text) as {
    items?: { name: string; price: number }[];
    tax?: number;
    subtotal?: number;
    total?: number;
  };

  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    taxAmount: parsed.tax || null,
    subtotal: parsed.subtotal || null,
    total: parsed.total || null,
  };
}
