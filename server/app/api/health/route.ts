// GET /api/health -> { ok, service, ocr, storage }
//
// Cheap liveness check the app pings on startup to decide whether the backend
// is reachable. Also reports whether the OCR (Gemini) and storage (Upstash)
// secrets are configured — booleans only, never the values.

import { json, preflight } from "@/lib/http";
import { isDbConfigured } from "@/lib/db";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

export function GET() {
  return json({
    ok: true,
    service: "tabby-backend",
    ocr: Boolean(process.env.GEMINI_API_KEY),
    storage: isDbConfigured(),
  });
}
