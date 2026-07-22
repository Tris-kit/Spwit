import { Person } from "./types";

export const money = (cents: number): string =>
  `$${(cents / 100).toFixed(2)}`;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function avatarLabel(p: Person): string {
  return p.emoji || initials(p.name);
}

/**
 * A prefilled Venmo web link for the payer to send `cents` to `handle`.
 * Falls back to a plain profile link if no amount. Venmo has no reliable public
 * deep-link spec, but this pattern opens the pay screen on mobile web.
 */
export function venmoLink(handle: string, cents: number, note: string): string {
  const h = handle.replace(/^@/, "");
  // Build the query manually with encodeURIComponent: URLSearchParams encodes
  // spaces as "+", which Venmo shows literally in the note instead of spaces.
  const q = [
    "txn=pay",
    `amount=${(cents / 100).toFixed(2)}`,
    `note=${encodeURIComponent(note)}`,
  ].join("&");
  return `https://venmo.com/${encodeURIComponent(h)}?${q}`;
}
