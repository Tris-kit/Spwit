let counter = 0;
/** Stable-ish unique id for list items created at runtime. */
export const makeId = (prefix: string): string =>
  `${prefix}_${counter++}_${Date.now()}`;

/** Format a US phone number as the user types: (123) 456-7890. */
export function formatPhone(input: string): string {
  const d = (input ?? "").replace(/\D/g, "").slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
