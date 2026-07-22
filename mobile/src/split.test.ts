// Quick sanity checks for the split engine. Run with: npx tsx src/split.test.ts
import { allocateProportionally, computeBreakdown, splitEqually } from "./split";
import { Bill } from "./types";

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}`, extra ?? "");
  }
}

// --- allocateProportionally ---------------------------------------------
const a = allocateProportionally(100, [1, 1, 1]); // 100c / 3
check("3-way 100c sums to 100", a.reduce((x, y) => x + y, 0) === 100, a);
check("3-way 100c is [34,33,33]", JSON.stringify(a) === JSON.stringify([34, 33, 33]), a);

const b = allocateProportionally(0, [5, 5]);
check("zero total -> zeros", JSON.stringify(b) === JSON.stringify([0, 0]), b);

const c = splitEqually(1000, 3); // $10 / 3
check("split $10/3 sums to 1000", c.reduce((x, y) => x + y, 0) === 1000, c);

// --- full breakdown -----------------------------------------------------
// Alice: burger 12.00. Bob: salad 8.00. Shared fries 5.00.
// tax 2.00, tip 20%.
const bill: Bill = {
  people: [
    { id: "a", name: "Alice", color: "#f00" },
    { id: "b", name: "Bob", color: "#00f" },
  ],
  items: [
    { id: "burger", name: "Burger", price: 12 },
    { id: "salad", name: "Salad", price: 8 },
    { id: "fries", name: "Fries", price: 5 },
  ],
  assignments: { burger: ["a"], salad: ["b"], fries: ["a", "b"] },
  charges: { taxAmount: 2, tipMode: "percent", tipPercent: 20, tipAmount: 0 },
};

const r = computeBreakdown(bill);
const sumTotals = r.perPerson.reduce((s, p) => s + p.totalCents, 0);

check("subtotal is $25.00", r.subtotalCents === 2500, r.subtotalCents);
check("tax is $2.00", r.taxCents === 200, r.taxCents);
check("tip 20% of 2500 is $5.00", r.tipCents === 500, r.tipCents);
check("grand total is $32.00", r.grandTotalCents === 3200, r.grandTotalCents);
check("per-person totals sum to grand total", sumTotals === r.grandTotalCents, {
  sumTotals,
  grand: r.grandTotalCents,
});

// Alice subtotal = 12 + 2.50 = 14.50 ; Bob = 8 + 2.50 = 10.50
const alice = r.perPerson.find((p) => p.person.id === "a")!;
const bob = r.perPerson.find((p) => p.person.id === "b")!;
check("Alice subtotal $14.50", alice.subtotalCents === 1450, alice.subtotalCents);
check("Bob subtotal $10.50", bob.subtotalCents === 1050, bob.subtotalCents);

// --- unassigned items ---------------------------------------------------
const bill2: Bill = {
  ...bill,
  assignments: { burger: ["a"], fries: ["a", "b"] }, // salad unassigned
};
const r2 = computeBreakdown(bill2);
check("one unassigned item flagged", r2.unassignedItems.length === 1, r2.unassignedItems);
check("unassigned subtotal excludes salad", r2.subtotalCents === 1700, r2.subtotalCents);

console.log(failures === 0 ? "\nALL PASSED ✅" : `\n${failures} FAILED ❌`);
process.exit(failures === 0 ? 0 : 1);
