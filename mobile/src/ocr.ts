// Receipt OCR via Claude vision (needs an API key).
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { ParsedReceipt } from "./receiptParse";

export type { ParsedReceipt } from "./receiptParse";
export { parseReceiptText } from "./receiptParse";

// Cheapest capable vision model (~8x cheaper than Opus). Swap to
// "claude-opus-4-8" if accuracy on messy receipts needs a boost.
const CLOUD_MODEL = "claude-haiku-4-5";
// Google's cheap, fast multimodal model.
const GEMINI_MODEL = "gemini-3.5-flash-lite";

// --- Cloud: Claude vision -------------------------------------------------

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          price: { type: "number" },
        },
        required: ["name", "price"],
      },
    },
    tax: { type: "number" },
    subtotal: { type: "number" },
    total: { type: "number" },
  },
  required: ["items", "tax", "subtotal", "total"],
} as const;

const PROMPT =
  "This is a photo of a restaurant receipt. Extract every ordered line item " +
  "with its individual line price as a number in dollars. Do NOT include " +
  "subtotal, tax, tip/gratuity, total, or payment lines as items. Report tax, " +
  "subtotal, and total separately — use 0 if a value isn't printed.";

export async function recognizeReceiptClaude(
  uri: string,
  apiKey: string,
): Promise<ParsedReceipt> {
  // Resize + compress so we send a small, cheap image (fewer tokens).
  const img = await manipulateAsync(uri, [{ resize: { width: 1100 } }], {
    base64: true,
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  if (!img.base64) throw new Error("Couldn't read the image file.");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLOUD_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: img.base64 },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
      output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401)
      throw new Error("API key was rejected (401). Double-check it in settings.");
    throw new Error(`Cloud OCR failed (${res.status}). ${body.slice(0, 160)}`);
  }

  const data = await res.json();
  if (data.stop_reason === "refusal")
    throw new Error("The model declined to read this image.");
  const textBlock = (data.content ?? []).find((b: any) => b.type === "text");
  if (!textBlock?.text) throw new Error("Empty response from the model.");

  const parsed = JSON.parse(textBlock.text);
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    taxAmount: parsed.tax || null,
    subtotal: parsed.subtotal || null,
    total: parsed.total || null,
  };
}

// --- Gemini: Google vision -------------------------------------------------

// Gemini uses its own schema dialect (uppercase types, no additionalProperties).
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

export async function recognizeReceiptGemini(
  uri: string,
  apiKey: string,
): Promise<ParsedReceipt> {
  const img = await manipulateAsync(uri, [{ resize: { width: 1100 } }], {
    base64: true,
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  if (!img.base64) throw new Error("Couldn't read the image file.");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: "image/jpeg", data: img.base64 } },
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
    if (res.status === 400 && /api[\s_-]?key/i.test(body))
      throw new Error("Gemini API key was rejected. Double-check it in settings.");
    throw new Error(`Gemini OCR failed (${res.status}). ${body.slice(0, 160)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini.");

  const parsed = JSON.parse(text);
  return {
    items: Array.isArray(parsed.items) ? parsed.items : [],
    taxAmount: parsed.tax || null,
    subtotal: parsed.subtotal || null,
    total: parsed.total || null,
  };
}
