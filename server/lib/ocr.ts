// Receipt OCR via Claude vision, run server-side with the org's key. This is the
// production replacement for the app's on-device key path: the client sends a
// small base64 JPEG, we call the model, and return structured line items.

import Anthropic from "@anthropic-ai/sdk";
import { ParsedReceipt } from "./types";

// Cheapest capable vision model. Receipt OCR is high-volume and simple, so Haiku
// is the deliberate cost choice here (~5x cheaper than Opus); bump to
// "claude-opus-4-8" if accuracy on messy receipts ever needs it.
const MODEL = "claude-haiku-4-5";

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

// Lazy so importing this module doesn't require ANTHROPIC_API_KEY at build time.
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  return _client;
}

export async function recognizeReceipt(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
): Promise<ParsedReceipt> {
  const res = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    // Constrain the response to our schema so we always get parseable JSON.
    output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
  } as Anthropic.MessageCreateParamsNonStreaming);

  if ((res.stop_reason as string) === "refusal") {
    throw new Error("The model declined to read this image.");
  }

  const textBlock = res.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  if (!textBlock?.text) throw new Error("Empty response from the model.");

  const parsed = JSON.parse(textBlock.text) as {
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
