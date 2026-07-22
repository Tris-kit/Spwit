// Minimal shape validation for incoming bills. We don't need a full schema
// library here — just enough to reject junk before it lands in Redis and to
// keep the share page from rendering garbage.

import { Bill } from "./types";

export function isValidBill(input: unknown): input is Bill {
  if (!input || typeof input !== "object") return false;
  const b = input as Record<string, unknown>;

  if (!Array.isArray(b.people) || !Array.isArray(b.items)) return false;
  if (b.people.length === 0) return false;
  if (typeof b.assignments !== "object" || b.assignments === null) return false;
  if (typeof b.charges !== "object" || b.charges === null) return false;

  const peopleOk = b.people.every(
    (p) =>
      p && typeof p === "object" &&
      typeof (p as any).id === "string" &&
      typeof (p as any).name === "string",
  );
  const itemsOk = b.items.every(
    (i) =>
      i && typeof i === "object" &&
      typeof (i as any).id === "string" &&
      typeof (i as any).price === "number",
  );
  if (!peopleOk || !itemsOk) return false;

  const c = b.charges as Record<string, unknown>;
  if (typeof c.taxAmount !== "number") return false;
  if (c.tipMode !== "percent" && c.tipMode !== "amount") return false;

  // Cap sizes so a single bill can't be used to store arbitrary large blobs.
  if (b.people.length > 100 || b.items.length > 500) return false;

  return true;
}

/** Strip a person down to what a public share page needs — drop contact PII. */
export function publicizePerson(p: any) {
  return {
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    isMe: p.isMe,
    // venmo/zelle are payment handles meant to be shared, so keep them; drop
    // phone (private) unless you later decide otherwise.
    venmo: p.venmo,
    zelle: p.zelle,
  };
}
