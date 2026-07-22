// Single Upstash Redis client for the whole backend (share-link store + rate
// limiter). Lazy so importing this doesn't require env vars at build time.
//
// Accepts BOTH env-var naming schemes, because the Vercel ↔ Upstash integration
// injects different names depending on version:
//   - native Upstash integration:  UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   - legacy Vercel KV:            KV_REST_API_URL        / KV_REST_API_TOKEN

import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

export function redisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
}

export function redisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
}

/** True when Redis credentials are present under either naming scheme. */
export function isRedisConfigured(): boolean {
  return Boolean(redisUrl() && redisToken());
}

export function getRedis(): Redis {
  if (_redis) return _redis;
  const url = redisUrl();
  const token = redisToken();
  if (!url || !token) {
    throw new Error(
      "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL/TOKEN " +
        "(or KV_REST_API_URL/TOKEN) — connect the Upstash integration in Vercel.",
    );
  }
  _redis = new Redis({ url, token });
  return _redis;
}
