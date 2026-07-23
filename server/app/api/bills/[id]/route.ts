// GET    /api/bills/:id                          -> public bill JSON (no token)
// PATCH  /api/bills/:id  { editToken, bill?, unpaid?, receiptImageUrl? }
// DELETE /api/bills/:id  { editToken }
//
// Reads are public (the id is the capability). Writes require the edit token
// handed back at creation time.

import { getBill, updateBill, verifyToken, deleteBill } from "@/lib/store";
import { isValidBill } from "@/lib/validate";
import { error, json, preflight } from "@/lib/http";
import { StoredBill } from "@/lib/types";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const stored = await getBill(id);
  if (!stored) return error("Bill not found.", 404);

  // Never leak the edit token; it's stored under a separate key anyway.
  const { id: billId, bill, receiptImageUrl, unpaid, createdAtISO, updatedAtISO } = stored;
  return json({ id: billId, bill, receiptImageUrl, unpaid, createdAtISO, updatedAtISO });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { editToken?: string; bill?: unknown; unpaid?: string[]; receiptImageUrl?: string | null };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body.", 400);
  }

  if (!(await verifyToken(id, body.editToken ?? ""))) {
    return error("Invalid edit token.", 403);
  }

  const existing = await getBill(id);
  if (!existing) return error("Bill not found.", 404);

  if (body.bill !== undefined && !isValidBill(body.bill)) {
    return error("Invalid bill.", 400);
  }

  const updated: StoredBill = {
    ...existing,
    bill: body.bill !== undefined ? body.bill : existing.bill,
    unpaid: body.unpaid !== undefined ? body.unpaid : existing.unpaid,
    receiptImageUrl:
      body.receiptImageUrl !== undefined ? body.receiptImageUrl : existing.receiptImageUrl,
    updatedAtISO: new Date().toISOString(),
  };

  await updateBill(updated);
  return json({ ok: true });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: { editToken?: string };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body.", 400);
  }

  if (!(await verifyToken(id, body.editToken ?? ""))) {
    return error("Invalid edit token.", 403);
  }

  await deleteBill(id);
  return json({ ok: true });
}
