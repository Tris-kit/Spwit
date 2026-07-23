// Sanity checks for the on-device receipt parser. Run: npx tsx src/receiptParse.test.ts
import { parseReceiptText } from "./receiptParse";

let failures = 0;
const check = (name: string, cond: boolean, extra?: unknown) => {
  if (cond) console.log(`  ok  ${name}`);
  else {
    failures++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
};

const SAMPLE = `
The Corner Bistro
123 Main St

2 Burger          24.00
Caesar Salad       9.50
Fries              5.00
Iced Tea    $3.25 A

Subtotal          41.75
Sales Tax          3.44
Tip               8.00
Total            53.19
VISA ************1234
Thank you!
`;

const r = parseReceiptText(SAMPLE);
const names = r.items.map((i) => i.name);

check("found 4 items", r.items.length === 4, names);
check("burger qty stripped", names.includes("Burger"), names);
check("keeps salad", names.includes("Caesar Salad"), names);
check("keeps $-prefixed iced tea", names.includes("Iced Tea"), names);
check("burger price 24.00", r.items.find((i) => i.name === "Burger")?.price === 24, r.items);
check("iced tea price 3.25", r.items.find((i) => i.name === "Iced Tea")?.price === 3.25, r.items);
check("tax detected 3.44", r.taxAmount === 3.44, r.taxAmount);
check("subtotal detected 41.75", r.subtotal === 41.75, r.subtotal);
check("total detected 53.19", r.total === 53.19, r.total);
check("tip not an item", !names.some((n) => /tip/i.test(n)), names);
check("visa not an item", !names.some((n) => /visa/i.test(n)), names);
check("no subtotal/total as item", !names.some((n) => /total/i.test(n)), names);

console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
