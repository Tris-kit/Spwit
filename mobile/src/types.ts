// Core data model for the receipt / tab splitter.

export type Person = {
  id: string;
  /**
   * Stable link to the saved contact this participant represents ("me" for the
   * owner). Optional and best-effort: the bill always keeps its own snapshot of
   * name/color/etc., so deleting the contact never erases the record — the link
   * just goes dangling. Enables future per-contact history/stats.
   */
  contactId?: string;
  name: string;
  emoji?: string; // avatar emoji; falls back to initials
  photo?: string; // avatar image uri; takes priority over emoji/initials
  phone?: string; // optional — useful for texting people their share
  venmo?: string; // Venmo handle (mainly for "me" — used in payment links)
  zelle?: string; // Zelle phone/email (mainly for "me" — shown in the text blast)
  color: string; // avatar background
  isMe?: boolean; // the phone's owner, auto-added to each bill
};

export type Item = {
  id: string;
  name: string;
  /** Line total in dollars (e.g. 12.50). One entry per line on the receipt. */
  price: number;
};

/** Maps an item id to the ids of the people sharing that item. */
export type Assignments = Record<string, string[]>;

export type TipMode = "percent" | "amount";

export type Charges = {
  /** Tax in dollars, usually read straight off the receipt. */
  taxAmount: number;
  tipMode: TipMode;
  /** When tipMode === "percent", the percent (e.g. 18 for 18%). */
  tipPercent: number;
  /** When tipMode === "amount", the tip in dollars. */
  tipAmount: number;
};

/** The full state of one bill being split. */
export type Bill = {
  name?: string; // optional label, e.g. "Sushi night"
  people: Person[];
  items: Item[];
  assignments: Assignments;
  charges: Charges;
};

/** A completed bill kept in history (only bills that reached the final step). */
export type SavedReceipt = {
  id: string;
  dateISO: string;
  bill: Bill;
  receiptImage: string | null;
  /** Person ids (from bill.people) marked NOT yet paid. Empty/undefined = all paid. */
  unpaid?: string[];
  /** Short-link id (Turso) once shared, plus the token to update that stored copy. */
  shareId?: string;
  shareEditToken?: string;
};
