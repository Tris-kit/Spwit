// POST /api/ocr  { imageBase64, mediaType? }  ->  ParsedReceipt
//
// Server-side receipt scanning. The client resizes/compresses the photo, sends
// the base64, and we run Claude vision with the org's key. Rate-limited per IP
// because this hits a paid model.

import { recognizeReceipt } from "@/lib/ocr";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { error, json, preflight } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp"]);

export function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`ocr:${ip}`, 30, 60 * 60); // 30 scans / hour / IP
  if (!limit.ok) {
    return error(`Rate limit reached. Try again in ${limit.resetSeconds}s.`, 429);
  }

  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body.", 400);
  }

  const imageBase64 = body.imageBase64?.trim();
  if (!imageBase64) return error("Missing imageBase64.", 400);
  // ~8MB of base64 ≈ 6MB raw — plenty for a compressed receipt photo.
  if (imageBase64.length > 8_000_000) return error("Image too large.", 413);

  const mediaType = ALLOWED_MEDIA.has(body.mediaType ?? "")
    ? (body.mediaType as "image/jpeg" | "image/png" | "image/webp")
    : "image/jpeg";

  try {
    const parsed = await recognizeReceipt(imageBase64, mediaType);
    return json(parsed);
  } catch (e) {
    const message = e instanceof Error ? e.message : "OCR failed.";
    return error(message, 502);
  }
}
