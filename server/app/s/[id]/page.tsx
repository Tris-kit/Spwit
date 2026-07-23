// Public share page: /s/:id — a server-rendered breakdown of a DB-stored split,
// viewable by anyone with the link (no app, no account). For DB-free sharing
// (bill encoded in the URL) see /v.

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getBill } from "@/lib/store";
import { computeBreakdown } from "@/lib/split";
import { money } from "@/lib/format";
import { BillView } from "@/components/BillView";

export const runtime = "nodejs";
// Bills change when the owner edits them; don't cache the page HTML.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const stored = await getBill(id);
  if (!stored) return { title: "Spwit" };
  const name = stored.bill.name?.trim();
  const total = computeBreakdown(stored.bill).grandTotalCents;
  const title = name ? `${name} · Spwit` : "Your split · Spwit";
  const description = `Total ${money(total)} · split ${stored.bill.people.length} ${
    stored.bill.people.length === 1 ? "way" : "ways"
  }`;
  // og:image is supplied automatically by opengraph-image.tsx in this folder.
  return {
    title,
    description,
    openGraph: { title, description, type: "website", url: `/s/${id}` },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stored = await getBill(id);
  if (!stored) notFound();

  return (
    <BillView
      bill={stored.bill}
      unpaid={stored.unpaid}
      receiptImageUrl={stored.receiptImageUrl}
    />
  );
}
