// Shared-bill persistence on Turso (libSQL). Each bill is one row: the full
// StoredBill as JSON, plus a creator-only edit token and a TTL. A share link is
// just "a blob of JSON behind a short id" — SQLite handles that trivially.

import { deflateRaw, inflateRaw } from "pako";
import { db } from "./db";
import { StoredBill } from "./types";

// Share links auto-expire (checked on read) so abandoned bills don't live forever.
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

// The bill JSON is deflate-compressed before storage (~80% smaller rows).
function pack(stored: StoredBill): string {
  return Buffer.from(deflateRaw(JSON.stringify(stored))).toString("base64");
}
function unpack(data: string): StoredBill | null {
  try {
    return JSON.parse(inflateRaw(Buffer.from(data, "base64"), { to: "string" })) as StoredBill;
  } catch {
    return null;
  }
}

export async function saveBill(stored: StoredBill, token: string): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "INSERT INTO bills (id, data, token, expires_at) VALUES (?, ?, ?, ?)",
    args: [stored.id, pack(stored), token, Date.now() + TTL_MS],
  });
}

export async function getBill(id: string): Promise<StoredBill | null> {
  const c = await db();
  const res = await c.execute({
    sql: "SELECT data, expires_at FROM bills WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) return null; // expired
  return unpack(String(row.data));
}

/** Check that the caller holds the bill's edit token. */
export async function verifyToken(id: string, token: string): Promise<boolean> {
  if (!token) return false;
  const c = await db();
  const res = await c.execute({
    sql: "SELECT token FROM bills WHERE id = ?",
    args: [id],
  });
  const row = res.rows[0];
  return !!row && String(row.token) === token;
}

/** Overwrite an existing bill (creator-only; call verifyToken first). */
export async function updateBill(stored: StoredBill): Promise<void> {
  const c = await db();
  await c.execute({
    sql: "UPDATE bills SET data = ?, expires_at = ? WHERE id = ?",
    args: [pack(stored), Date.now() + TTL_MS, stored.id],
  });
}

export async function deleteBill(id: string): Promise<void> {
  const c = await db();
  await c.execute({ sql: "DELETE FROM bills WHERE id = ?", args: [id] });
}

/**
 * Public, low-privilege action: a payer marks themselves paid (no edit token).
 * Removes the person from `unpaid`; if the bill wasn't tracking yet, seeds it
 * with everyone who owes (non-owner) so the rest still show as unpaid.
 * Returns the updated bill, or null if not found.
 */
export async function markPaid(id: string, personId: string): Promise<StoredBill | null> {
  const existing = await getBill(id);
  if (!existing) return null;
  const owing = existing.bill.people.filter((p) => !p.isMe).map((p) => p.id);
  const current = existing.unpaid ?? owing;
  const updated: StoredBill = {
    ...existing,
    unpaid: current.filter((pid) => pid !== personId),
    updatedAtISO: new Date().toISOString(),
  };
  await updateBill(updated);
  return updated;
}
