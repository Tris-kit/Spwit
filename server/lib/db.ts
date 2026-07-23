// Turso (libSQL / SQLite) client for the backend — share-link store + rate
// limiter. Lazy so importing this (e.g. during `next build`) doesn't require the
// credentials; the connection and schema are set up on first use at runtime.

import { createClient, type Client } from "@libsql/client";

let _client: Client | null = null;
let _schema: Promise<void> | null = null;

export function isDbConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL);
}

function raw(): Client {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set — connect the Turso database in Vercel.",
    );
  }
  _client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
  return _client;
}

// Create tables once per process (retried if it errors). CREATE TABLE IF NOT
// EXISTS is idempotent, so this is safe to run on every cold start.
async function ensureSchema(c: Client): Promise<void> {
  if (!_schema) {
    _schema = c
      .batch(
        [
          `CREATE TABLE IF NOT EXISTS bills (
             id TEXT PRIMARY KEY,
             data TEXT NOT NULL,
             token TEXT NOT NULL,
             expires_at INTEGER NOT NULL
           )`,
          `CREATE TABLE IF NOT EXISTS rate_limits (
             key TEXT PRIMARY KEY,
             count INTEGER NOT NULL,
             expires_at INTEGER NOT NULL
           )`,
        ],
        "write",
      )
      .then(() => undefined)
      .catch((e) => {
        _schema = null; // allow a later request to retry
        throw e;
      });
  }
  return _schema;
}

/** Get the client with the schema guaranteed to exist. */
export async function db(): Promise<Client> {
  const c = raw();
  await ensureSchema(c);
  return c;
}
