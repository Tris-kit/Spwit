import { randomBytes } from "crypto";

const ALPHABET = "0123456789abcdefghijkmnpqrstuvwxyz"; // no l/o to avoid ambiguity

/** Short, URL-safe, unguessable id for a shared bill (e.g. "k4f9x2"). */
export function shortId(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** Long secret handed to the bill's creator so only they can edit it later. */
export function editToken(): string {
  return randomBytes(24).toString("hex");
}
