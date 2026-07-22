// Client for the Tabby backend (server/). Two production paths:
//   1. Receipt OCR via the server's key — no on-device API key needed.
//   2. Shareable bill links — publish a split to a web page anyone can open.
//
// Set the base URL at build time:  EXPO_PUBLIC_API_BASE=https://your.vercel.app
// Until it's set, isBackendEnabled() is false and callers should fall back to
// the existing on-device flow.

import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { Bill } from "./types";
import { ParsedReceipt } from "./receiptParse";

const BASE = (process.env.EXPO_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export const isBackendEnabled = (): boolean => BASE.length > 0;

function requireBase(): string {
  if (!BASE) throw new Error("EXPO_PUBLIC_API_BASE is not set.");
  return BASE;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${requireBase()}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
}

// --- OCR --------------------------------------------------------------------

/** Resize/compress a receipt photo and scan it via the backend proxy. */
export async function scanReceiptViaBackend(uri: string): Promise<ParsedReceipt> {
  const img = await manipulateAsync(uri, [{ resize: { width: 1100 } }], {
    base64: true,
    compress: 0.6,
    format: SaveFormat.JPEG,
  });
  if (!img.base64) throw new Error("Couldn't read the image file.");

  return postJson<ParsedReceipt>("/api/ocr", {
    imageBase64: img.base64,
    mediaType: "image/jpeg",
  });
}

// --- Shareable bills --------------------------------------------------------

export type ShareResult = { id: string; url: string; editToken: string };

/** Publish a bill and get back a public link + an edit token to keep locally. */
export async function shareBill(
  bill: Bill,
  opts: { receiptImageUrl?: string | null; unpaid?: string[] } = {},
): Promise<ShareResult> {
  return postJson<ShareResult>("/api/bills", {
    bill,
    receiptImageUrl: opts.receiptImageUrl ?? null,
    unpaid: opts.unpaid,
  });
}

/** Push a later edit (paid status, added Venmo/phone) to an already-shared bill. */
export async function updateSharedBill(
  id: string,
  editToken: string,
  patch: { bill?: Bill; unpaid?: string[]; receiptImageUrl?: string | null },
): Promise<void> {
  const res = await fetch(`${requireBase()}/api/bills/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ editToken, ...patch }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Update failed (${res.status}).`);
  }
}

export async function deleteSharedBill(id: string, editToken: string): Promise<void> {
  const res = await fetch(`${requireBase()}/api/bills/${id}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ editToken }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as any)?.error || `Delete failed (${res.status}).`);
  }
}
