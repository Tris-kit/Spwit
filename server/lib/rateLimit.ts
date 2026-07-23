// Fixed-window rate limiting on Turso (libSQL). The OCR route calls a paid
// model, so a leaked endpoint shouldn't be able to run up the bill; bill
// creation is cheaper but still worth capping against spam.

import { db } from "./db";

export type RateLimitResult = { ok: boolean; remaining: number; resetSeconds: number };

/**
 * Allow at most `limit` requests per `windowSeconds` for a given key, using an
 * atomic upsert on a per-window bucket row. Fails open: rate limiting is a
 * safeguard, not a hard dependency — if the store is unavailable we allow the
 * request rather than 500 the endpoint it guards (e.g. OCR only needs Gemini).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const now = Math.floor(Date.now() / 1000);
  const bucket = Math.floor(now / windowSeconds);
  const bucketKey = `${key}:${bucket}`;
  const expiresAt = (bucket + 1) * windowSeconds;

  try {
    const c = await db();
    const res = await c.execute({
      sql: `INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
            ON CONFLICT(key) DO UPDATE SET count = count + 1
            RETURNING count`,
      args: [bucketKey, expiresAt],
    });
    const count = Number(res.rows[0]?.count ?? 1);
    return {
      ok: count <= limit,
      remaining: Math.max(0, limit - count),
      resetSeconds: expiresAt - now,
    };
  } catch (e) {
    console.error("rateLimit: store unavailable, allowing request:", e);
    return { ok: true, remaining: limit, resetSeconds: windowSeconds };
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
