// GET /s/:id/pay?p=:personId
// A payer taps "Pay on Venmo" → we optimistically mark them paid, then 302 to
// the prefilled Venmo link. Public (no edit token) and best-effort: if anything
// is missing we just fall back to the share page. Works without JS.
import { NextResponse } from "next/server";
import { getBill, markPaid } from "@/lib/store";
import { computeBreakdown } from "@/lib/split";
import { venmoLink } from "@/lib/format";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const personId = new URL(req.url).searchParams.get("p") ?? "";
  const back = new URL(`/s/${id}`, req.url);

  const stored = await getBill(id);
  if (!stored) return NextResponse.redirect(back);

  // Optimistically mark this person paid (they're headed to Venmo to settle up).
  await markPaid(id, personId).catch(() => {});

  const owner = stored.bill.people.find((p) => p.isMe);
  const person = stored.bill.people.find((p) => p.id === personId);
  const pb = computeBreakdown(stored.bill).perPerson.find((x) => x.person.id === personId);
  if (!owner?.venmo?.trim() || !person || !pb) return NextResponse.redirect(back);

  const eventName = stored.bill.name?.trim() || "Meal";
  const ownerName = owner.name?.trim();
  const note = `${eventName}${ownerName ? ` with ${ownerName}` : ""} - ${person.name}`;
  return NextResponse.redirect(venmoLink(owner.venmo.trim(), pb.totalCents, note));
}
