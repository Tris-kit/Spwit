// Shared-bill persistence on Upstash Redis (Vercel KV Marketplace integration).
//
// A share link is just "a blob of bill JSON behind a short id" — a KV problem,
// not a relational one. Each bill stores an edit token so the creator (and only
// the creator) can update it later; the token is never returned on public reads.

import { Redis } from "@upstash/redis";
import { StoredBill } from "./types";

// Lazy singleton so importing this module (e.g. during `next build`) doesn't
// require the Upstash env vars to be present — they're only needed at runtime.
let _redis: Redis | null = null;
function redisClient(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

// Share links auto-expire so abandoned bills don't accumulate forever.
const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days

const billKey = (id: string) => `bill:${id}`;
const tokenKey = (id: string) => `bill:${id}:token`;

export async function saveBill(stored: StoredBill, token: string): Promise<void> {
  await Promise.all([
    redisClient().set(billKey(stored.id), stored, { ex: TTL_SECONDS }),
    redisClient().set(tokenKey(stored.id), token, { ex: TTL_SECONDS }),
  ]);
}

export async function getBill(id: string): Promise<StoredBill | null> {
  // Upstash auto-deserializes JSON values written via set(obj).
  return (await redisClient().get<StoredBill>(billKey(id))) ?? null;
}

/** Constant-ish check that the caller holds the bill's edit token. */
export async function verifyToken(id: string, token: string): Promise<boolean> {
  if (!token) return false;
  const stored = await redisClient().get<string>(tokenKey(id));
  return typeof stored === "string" && stored.length > 0 && stored === token;
}

/** Overwrite an existing bill (creator-only; call verifyToken first). */
export async function updateBill(stored: StoredBill): Promise<void> {
  await redisClient().set(billKey(stored.id), stored, { ex: TTL_SECONDS });
}

export async function deleteBill(id: string): Promise<void> {
  await Promise.all([redisClient().del(billKey(id)), redisClient().del(tokenKey(id))]);
}
