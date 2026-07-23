// Bill-splitting logic, ported verbatim from the app's src/split.ts so the
// share page computes identical per-person totals. Keep the two in sync.
//
// Everything is done in integer cents with "largest remainder" distribution so
// per-person totals always sum back to the exact grand total.

import { Bill, Charges, Item, Person } from "./types";

export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const toDollars = (cents: number): string => (cents / 100).toFixed(2);

export type PersonBreakdown = {
  person: Person;
  lines: { item: Item; shareCents: number; sharedWith: number }[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  totalCents: number;
};

export type BillBreakdown = {
  perPerson: PersonBreakdown[];
  subtotalCents: number;
  taxCents: number;
  tipCents: number;
  grandTotalCents: number;
  unassignedItems: Item[];
};

export function allocateProportionally(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || weightSum === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  const remainder = total - floors.reduce((a, b) => a + b, 0);

  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }
  return result;
}

export function splitEqually(totalCents: number, n: number): number[] {
  if (n <= 0) return [];
  return allocateProportionally(totalCents, new Array(n).fill(1));
}

function tipCentsFor(charges: Charges, subtotalCents: number): number {
  if (charges.tipMode === "amount") return toCents(charges.tipAmount);
  return Math.round((subtotalCents * charges.tipPercent) / 100);
}

export function computeBreakdown(bill: Bill): BillBreakdown {
  const { people, items, assignments, charges } = bill;

  const subtotal: Record<string, number> = {};
  const lines: Record<string, PersonBreakdown["lines"]> = {};
  for (const p of people) {
    subtotal[p.id] = 0;
    lines[p.id] = [];
  }

  const unassignedItems: Item[] = [];

  for (const item of items) {
    const sharers = (assignments[item.id] ?? []).filter((id) => subtotal[id] !== undefined);
    const itemCents = toCents(item.price);

    if (sharers.length === 0) {
      unassignedItems.push(item);
      continue;
    }

    const shares = splitEqually(itemCents, sharers.length);
    sharers.forEach((personId, idx) => {
      subtotal[personId] += shares[idx];
      lines[personId].push({ item, shareCents: shares[idx], sharedWith: sharers.length });
    });
  }

  const assignedSubtotalCents = people.reduce((sum, p) => sum + subtotal[p.id], 0);

  const taxCents = toCents(charges.taxAmount);
  const tipCents = tipCentsFor(charges, assignedSubtotalCents);

  const weights = people.map((p) => subtotal[p.id]);
  const taxShares = allocateProportionally(taxCents, weights);
  const tipShares = allocateProportionally(tipCents, weights);

  const perPerson: PersonBreakdown[] = people.map((p, i) => ({
    person: p,
    lines: lines[p.id],
    subtotalCents: subtotal[p.id],
    taxCents: taxShares[i],
    tipCents: tipShares[i],
    totalCents: subtotal[p.id] + taxShares[i] + tipShares[i],
  }));

  return {
    perPerson,
    subtotalCents: assignedSubtotalCents,
    taxCents,
    tipCents,
    grandTotalCents: assignedSubtotalCents + taxCents + tipCents,
    unassignedItems,
  };
}
