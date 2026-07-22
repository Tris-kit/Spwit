// DB-free bill sharing: the whole bill (minus the photo and private phone
// numbers) is base64url-encoded into the /v link's hash fragment, so no server
// storage is needed. Keep encode/decode in sync with the app's src/shareLink.ts.

import { Bill } from "./types";

// UTF-8-safe base64 using only btoa/atob + encodeURIComponent — works in the
// browser and in React Native (Hermes). Handles emoji/unicode in names.
function b64EncodeUtf8(str: string): string {
  const bin = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)),
  );
  return btoa(bin);
}

function b64DecodeUtf8(b64: string): string {
  const bin = atob(b64);
  let pct = "";
  for (let i = 0; i < bin.length; i++) {
    pct += "%" + ("00" + bin.charCodeAt(i).toString(16)).slice(-2);
  }
  return decodeURIComponent(pct);
}

const toUrlSafe = (b64: string) =>
  b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromUrlSafe = (s: string) => s.replace(/-/g, "+").replace(/_/g, "/");

// Only the fields the breakdown needs to render. Photo, phone, and contactId are
// dropped (photo is too big for a URL; phone is private).
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
  return toUrlSafe(b64EncodeUtf8(JSON.stringify(compact(bill))));
}

export function decodeBill(encoded: string): Bill | null {
  try {
    const bill = JSON.parse(b64DecodeUtf8(fromUrlSafe(encoded)));
    if (!bill || !Array.isArray(bill.people) || !Array.isArray(bill.items)) return null;
    if (!bill.charges || typeof bill.charges !== "object") return null;
    return bill as Bill;
  } catch {
    return null;
  }
}
