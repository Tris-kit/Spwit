// Pure receipt-text parser (no native deps) — used by the on-device OCR path
// and unit-testable on its own.

export type ParsedReceipt = {
  items: { name: string; price: number }[];
  taxAmount: number | null;
  subtotal: number | null;
  total: number | null;
};

// Lines we never treat as an orderable item.
const SKIP =
  /\b(balance|amount\s*due|tip|gratuity|cash|change|visa|master|amex|debit|credit|card|approv|auth|ref|terminal|merchant|server|table|guest|order|thank|phone|tel|fax|www|http|receipt|qty|invoice|date|time)\b/i;
const TAX = /\b(tax|hst|gst|vat|pst)\b/i;
const SUBTOTAL = /\bsub[\s-]*total\b/i;
const TOTAL = /\b(total|amount due|balance due)\b/i;
// A trailing money amount, absorbing a leading $ and a trailing tax-code letter/*.
const MONEY = /\$?\s*(-?\d{1,4}[.,]\d{2})\s*[A-Za-z*]?\s*$/;

/** Turn raw OCR text into structured line items + detected tax/total. Pure. */
export function parseReceiptText(raw: string): ParsedReceipt {
  const items: { name: string; price: number }[] = [];
  let taxAmount: number | null = null;
  let subtotal: number | null = null;
  let total: number | null = null;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const m = line.match(MONEY);
    if (!m || m.index === undefined) continue;
    const amount = parseFloat(m[1].replace(",", "."));
    if (isNaN(amount)) continue;

    // Classify special lines first (order matters: "subtotal" contains "total").
    if (SUBTOTAL.test(line)) {
      subtotal = amount;
      continue;
    }
    if (TAX.test(line)) {
      taxAmount = (taxAmount ?? 0) + amount; // sum multiple tax lines
      continue;
    }
    if (TOTAL.test(line)) {
      total = amount;
      continue;
    }
    if (SKIP.test(line)) continue;

    // Everything before the price is the item name; strip a leading quantity.
    let name = line.slice(0, m.index).trim();
    name = name.replace(/^\d+\s*[xX]?\s*/, "").trim();
    name = name.replace(/[\s.\-$]+$/, "").trim();

    if (name.length < 2) continue;
    if (amount <= 0 || amount > 1000) continue; // sanity bounds

    items.push({ name, price: amount });
  }

  return { items, taxAmount, subtotal, total };
}
