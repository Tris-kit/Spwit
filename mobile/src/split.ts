// Pure bill-splitting logic. No React here so it's easy to test.
//
// Strategy: do everything in integer cents to avoid floating-point drift,
// and use "largest remainder" distribution so the per-person totals always
// sum back to the exact grand total (no stray or missing pennies).

import { Bill, Charges, Item, Person } from "./types";

export const toCents = (dollars: number): number => Math.round(dollars * 100);
export const toDollars = (cents: number): string => (cents / 100).toFixed(2);

export type PersonBreakdown = {
  person: Person;
  /** Items this person is on, with the cents they owe for each. */
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
  /** Items nobody has been assigned to yet — surfaced as a warning in the UI. */
  unassignedItems: Item[];
};

/**
 * Split `total` cents across `weights` proportionally, returning integer cents
 * that sum exactly to `total`. Leftover pennies go to the largest fractional
 * remainders first (deterministic, stable ordering).
 */
export function allocateProportionally(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || weightSum === 0) return weights.map(() => 0);

  const exact = weights.map((w) => (total * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let remainder = total - floors.reduce((a, b) => a + b, 0);

  // Rank indices by fractional part, largest first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder; k++) {
    result[order[k % order.length].i] += 1;
  }
  return result;
}

/** Split a single item's cents equally among n people, remainders to the front. */
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

  // Per-person running totals in cents.
  const subtotal: Record<string, number> = {};
  const lines: Record<string, PersonBreakdown["lines"]> = {};
  for (const p of people) {
    subtotal[p.id] = 0;
    lines[p.id] = [];
  }

  const unassignedItems: Item[] = [];
  let subtotalCents = 0;

  for (const item of items) {
    const sharers = (assignments[item.id] ?? []).filter((id) => subtotal[id] !== undefined);
    const itemCents = toCents(item.price);
    subtotalCents += itemCents;

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

  // Only bill tax/tip against the portion of the subtotal that's actually
  // assigned, so unassigned items don't silently inflate anyone's share.
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
