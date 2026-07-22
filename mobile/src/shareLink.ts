// DB-free breakdown sharing: deflate-compress + base64url-encode the whole bill
// (minus the photo and private phone numbers) into a URL the recipient opens in
// any browser — no account, no server storage. Compression keeps even large
// bills to ~1KB. Must stay in sync with the backend's lib/billCodec.ts.
import { deflateRaw } from "pako";
import { Share } from "react-native";
import { Bill } from "./types";

const BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export const canShareBreakdown = (): boolean => BASE.length > 0;

// Base64 of raw bytes (btoa exists in React Native / Hermes).
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}
const toUrlSafe = (b64: string) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Only the fields the breakdown needs; photo/phone/contactId are dropped.
function compact(bill: Bill): Bill {
  return {
    name: bill.name,
    people: bill.people.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      emoji: p.emoji,
      venmo: p.venmo,
      zelle: p.zelle,
      isMe: p.isMe,
    })),
    items: bill.items.map((i) => ({ id: i.id, name: i.name, price: i.price })),
    assignments: bill.assignments,
    charges: bill.charges,
  };
}

export function encodeBill(bill: Bill): string {
  const json = JSON.stringify(compact(bill));
  return toUrlSafe(bytesToB64(deflateRaw(json)));
}

export function buildShareUrl(bill: Bill): string {
  return `${BASE}/v#${encodeBill(bill)}`;
}

/** Open the OS share sheet with a link to the breakdown. */
export async function shareBreakdown(bill: Bill): Promise<void> {
  const url = buildShareUrl(bill);
  const title = bill.name?.trim() ? `Tabby split — ${bill.name.trim()}` : "Tabby split";
  await Share.share({ message: `${title}\n${url}`, url });
}
