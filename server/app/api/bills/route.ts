// POST /api/bills  { bill, receiptImageUrl?, unpaid? }
//   -> { id, url, editToken }
//
// Creates a shareable bill. The returned editToken is the creator's secret for
// later updates — the app should store it alongside the bill id. No auth: the id
// is unguessable and the token gates writes.

import { saveBill } from "@/lib/store";
import { isValidBill } from "@/lib/validate";
import { editToken, shortId } from "@/lib/ids";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { error, json, originFrom, preflight } from "@/lib/http";
import { Bill, StoredBill } from "@/lib/types";

export const runtime = "nodejs";

export function OPTIONS() {
  return preflight();
}

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limit = await rateLimit(`bills:${ip}`, 60, 60 * 60); // 60 shares / hour / IP
  if (!limit.ok) {
    return error(`Rate limit reached. Try again in ${limit.resetSeconds}s.`, 429);
  }

  let body: { bill?: unknown; receiptImageUrl?: string | null; unpaid?: string[] };
  try {
    body = await req.json();
  } catch {
    return error("Invalid JSON body.", 400);
  }

  if (!isValidBill(body.bill)) return error("Invalid or missing bill.", 400);

  const id = shortId();
  const token = editToken();
  const nowISO = new Date().toISOString();

  // Start paid-tracking with everyone who owes (non-owner) marked unpaid, so the
  // share page shows status from the start and payers flip themselves to paid.
  const bill = body.bill as Bill;
  const defaultUnpaid = bill.people.filter((p) => !p.isMe).map((p) => p.id);

  const stored: StoredBill = {
    id,
    bill: body.bill,
    receiptImageUrl: body.receiptImageUrl ?? null,
    unpaid: Array.isArray(body.unpaid) ? body.unpaid : defaultUnpaid,
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
  };

  await saveBill(stored, token);

  return json({ id, url: `${originFrom(req)}/s/${id}`, editToken: token }, 201);
}
