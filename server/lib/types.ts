// Bill data model — kept in sync with the app's src/types.ts. The backend only
// ever stores and reads these shapes; it never mutates a bill's semantics.

export type Person = {
  id: string;
  contactId?: string;
  name: string;
  emoji?: string;
  photo?: string;
  phone?: string;
  venmo?: string;
  zelle?: string;
  color: string;
  isMe?: boolean;
};

export type Item = {
  id: string;
  name: string;
  price: number;
};

/** Maps an item id to the ids of the people sharing that item. */
export type Assignments = Record<string, string[]>;

export type TipMode = "percent" | "amount";

export type Charges = {
  taxAmount: number;
  tipMode: TipMode;
  tipPercent: number;
  tipAmount: number;
};

export type Bill = {
  name?: string;
  people: Person[];
  items: Item[];
  assignments: Assignments;
  charges: Charges;
};

/** What gets persisted behind a share id. */
export type StoredBill = {
  id: string;
  bill: Bill;
  /** Optional hosted receipt image URL (not the local device uri). */
  receiptImageUrl?: string | null;
  /** Person ids marked NOT yet paid. Empty/undefined = everyone's settled. */
  unpaid?: string[];
  createdAtISO: string;
  updatedAtISO: string;
};

/** Parser output from the OCR proxy. */
export type ParsedReceipt = {
  items: { name: string; price: number }[];
  taxAmount: number | null;
  subtotal: number | null;
  total: number | null;
};
