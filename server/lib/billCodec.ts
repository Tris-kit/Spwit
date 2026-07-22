// DB-free bill sharing: the whole bill (minus the photo and private phone
// numbers) is deflate-compressed and base64url-encoded into the /v link's hash
// fragment, so no server storage is needed. Compression keeps even large
// (20-person) bills to ~1KB. Keep in sync with the app's src/shareLink.ts.

import { deflateRaw, inflateRaw } from "pako";
import { Bill } from "./types";

// Base64 of raw bytes (btoa/atob exist in the browser and React Native/Hermes).
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const toUrlSafe = (b64: string) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrlSafe = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");

// Only the fields the breakdown needs. Photo, phone, and contactId are dropped
// (photo is too big for a URL; phone is private).
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

export function decodeBill(encoded: string): Bill | null {
  try {
    const json = inflateRaw(b64ToBytes(fromUrlSafe(encoded)), { to: "string" });
    const bill = JSON.parse(json);
    if (!bill || !Array.isArray(bill.people) || !Array.isArray(bill.items)) return null;
    if (!bill.charges || typeof bill.charges !== "object") return null;
    return bill as Bill;
  } catch {
    return null;
  }
}
