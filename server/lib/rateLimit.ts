// Lightweight fixed-window rate limiting on Redis. The OCR route calls a paid
// model, so a leaked endpoint shouldn't be able to run up the bill; bill
// creation is cheaper but still worth capping against spam.

import { getRedis } from "./redis";

export type RateLimitResult = { ok: boolean; remaining: number; resetSeconds: number };

/**
 * Allow at most `limit` requests per `windowSeconds` for a given key.
 * Uses INCR + EXPIRE on a per-window bucket — cheap and good enough here.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const redisKey = `rl:${key}:${bucket}`;

  try {
    const count = await getRedis().incr(redisKey);
    if (count === 1) await getRedis().expire(redisKey, windowSeconds);

    const remaining = Math.max(0, limit - count);
    const resetSeconds = windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds);
    return { ok: count <= limit, remaining, resetSeconds };
  } catch (e) {
    // Fail open: rate limiting is a safeguard, not a hard dependency. If the
    // store is unconfigured or unreachable, don't 500 the request it guards
    // (e.g. OCR only needs Gemini). Surfaces in logs for visibility.
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
