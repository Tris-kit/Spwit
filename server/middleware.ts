// CORS for the Spwit web app. The browser build (app.spwit.app) calls this
// backend cross-origin, so /api/* must send CORS headers and answer preflight
// OPTIONS requests. Native apps don't do CORS checks — this is web-only.
import { NextResponse, type NextRequest } from "next/server";

// Exact origins that may call the API.
const ALLOWED_ORIGINS = new Set([
  "https://app.spwit.app",
  "http://localhost:8081", // expo start --web
  "http://localhost:8099", // local static preview
]);

function isAllowed(origin: string | null): origin is string {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel preview deployments of the web app (e.g. spwit-app-*.vercel.app).
  try {
    return new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

function applyCors(res: NextResponse, origin: string): NextResponse {
  res.headers.set("Access-Control-Allow-Origin", origin);
  res.headers.set("Vary", "Origin");
  res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "content-type");
  res.headers.set("Access-Control-Max-Age", "86400");
  return res;
}

export function middleware(req: NextRequest): NextResponse {
  const origin = req.headers.get("origin");
  if (!isAllowed(origin)) {
    // Non-browser (native app) or disallowed origin — pass through untouched.
    return NextResponse.next();
  }

  // Preflight: answer directly, no body.
  if (req.method === "OPTIONS") {
    return applyCors(new NextResponse(null, { status: 204 }), origin);
  }

  return applyCors(NextResponse.next(), origin);
}

export const config = {
  matcher: "/api/:path*",
};
