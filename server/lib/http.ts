// Small helpers for JSON responses + permissive CORS. Native app requests don't
// enforce CORS, but Expo Web (and browser tools) do, so we allow all origins on
// the API. These are public, unauthenticated endpoints by design.

import { NextResponse } from "next/server";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: CORS_HEADERS });
}

export function error(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status, headers: CORS_HEADERS });
}

/** Handle CORS preflight. Re-export as `OPTIONS` from any route that needs it. */
export function preflight(): NextResponse {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/** Absolute origin for building share links — env override, else request host. */
export function originFrom(req: Request): string {
  const env = process.env.NEXT_PUBLIC_BASE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host") ?? "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
