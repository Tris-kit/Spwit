// Presentational breakdown of a split — shared by the DB-backed share page
// (/s/:id) and the URL-encoded view page (/v). Pure/no data fetching, so it
// renders in both server and client component trees.

import { Bill } from "@/lib/types";
import { computeBreakdown } from "@/lib/split";
import { money, avatarLabel, venmoLink } from "@/lib/format";

export function BillView({
  bill,
  unpaid,
  receiptImageUrl,
  shareId,
}: {
  bill: Bill;
  unpaid?: string[];
  receiptImageUrl?: string | null;
  // When set (DB-backed /s pages), pay links route through /s/:id/pay so the
  // payer is marked paid before redirecting to Venmo.
  shareId?: string;
}) {
  const breakdown = computeBreakdown(bill);
  const unpaidSet = new Set(unpaid ?? []);

  // Everyone pays the bill owner ("me"), each with their own total pre-filled.
  const owner = bill.people.find((p) => p.isMe);
  const ownerName = owner?.name?.trim();
  const ownerVenmo = owner?.venmo?.trim();
  const ownerZelle = owner?.zelle?.trim();
  const eventName = bill.name?.trim();

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" width={22} height={22} style={{ display: "block" }} />
            <span>Spwit</span>
          </div>
          <h1 style={styles.title}>{bill.name?.trim() || "Your split"}</h1>
          <div style={styles.subtitle}>
            {money(breakdown.grandTotalCents)} · {bill.people.length}{" "}
            {bill.people.length === 1 ? "person" : "people"}
          </div>
        </header>

        {breakdown.unassignedItems.length > 0 && (
          <div style={styles.warning}>
            {breakdown.unassignedItems.length} item
            {breakdown.unassignedItems.length === 1 ? "" : "s"} not yet assigned to anyone.
          </div>
        )}

        <section style={styles.cards}>
          {breakdown.perPerson.map((pb) => {
            const isUnpaid = unpaidSet.has(pb.person.id);
            // The owner is owed, not paying — everyone else gets a pay link.
            const canPay = !pb.person.isMe && (ownerVenmo || ownerZelle);
            // Venmo note: "<bill> with <owner> - <sender>" (bill falls back to "Meal").
            const payNote = `${eventName || "Meal"}${ownerName ? ` with ${ownerName}` : ""} - ${pb.person.name}`;
            return (
              <div key={pb.person.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <div style={{ ...styles.avatar, background: pb.person.color || "var(--primary-dim)" }}>
                    {avatarLabel(pb.person)}
                  </div>
                  <div style={styles.who}>
                    <div style={styles.name}>{pb.person.name}</div>
                    {unpaid !== undefined && (
                      <div style={isUnpaid ? styles.badgeUnpaid : styles.badgePaid}>
                        {isUnpaid ? "Unpaid" : "Paid"}
                      </div>
                    )}
                  </div>
                  <div style={styles.amount}>{money(pb.totalCents)}</div>
                </div>

                <ul style={styles.lines}>
                  {pb.lines.map((l, i) => (
                    <li key={i} style={styles.line}>
                      <span style={styles.lineName}>
                        <span>{l.item.name}</span>
                        {l.sharedWith > 1 ? (
                          <span style={styles.shared}>
                            ${l.item.price.toFixed(2)} split {l.sharedWith} ways
                          </span>
                        ) : null}
                      </span>
                      <span style={styles.lineAmt}>{money(l.shareCents)}</span>
                    </li>
                  ))}
                  <li style={{ ...styles.line, ...styles.lineMuted }}>
                    <span>Tax</span>
                    <span>{money(pb.taxCents)}</span>
                  </li>
                  <li style={{ ...styles.line, ...styles.lineMuted }}>
                    <span>Tip</span>
                    <span>{money(pb.tipCents)}</span>
                  </li>
                </ul>

                {canPay && (
                  <div style={styles.pay}>
                    {ownerVenmo && (
                      <a
                        style={styles.payBtn}
                        href={
                          shareId
                            ? `/s/${shareId}/pay?p=${pb.person.id}`
                            : venmoLink(ownerVenmo, pb.totalCents, payNote)
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Pay {ownerName ? `${ownerName} ` : ""}
                        {money(pb.totalCents)} on Venmo
                      </a>
                    )}
                    {ownerZelle && (
                      <div style={styles.zelle}>
                        Zelle {ownerZelle} · {money(pb.totalCents)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section style={styles.totals}>
          <Row label="Subtotal" value={money(breakdown.subtotalCents)} />
          <Row label="Tax" value={money(breakdown.taxCents)} />
          <Row label="Tip" value={money(breakdown.tipCents)} />
          <Row label="Total" value={money(breakdown.grandTotalCents)} strong />
        </section>

        {receiptImageUrl && (
          <section style={styles.receiptWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptImageUrl} alt="Receipt" style={styles.receipt} />
          </section>
        )}

        <footer style={styles.footer}>
          <a
            href={venmoLink("tristan-schwichow", 500, "Coffee for the Spwit dev ☕")}
            target="_blank"
            rel="noreferrer"
            style={styles.coffee}
          >
            ☕ Buy me a coffee
          </a>
          <div style={styles.footerNote}>Split with Spwit</div>
        </footer>
      </div>
    </main>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ ...styles.totalRow, ...(strong ? styles.totalRowStrong : {}) }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", padding: "24px 16px 48px" },
  container: { maxWidth: 560, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 20 },
  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    color: "var(--primary)",
    fontWeight: 800,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontSize: 13,
  },
  title: { fontSize: 26, fontWeight: 800, margin: "6px 0 4px" },
  subtitle: { color: "var(--text-dim)", fontSize: 15 },
  warning: {
    background: "var(--warning-tint)",
    color: "var(--warning)",
    border: "1px solid var(--warning-border)",
    borderRadius: 12,
    padding: "10px 14px",
    fontSize: 14,
    marginBottom: 16,
  },
  cards: { display: "flex", flexDirection: "column", gap: 12 },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 16,
  },
  cardHead: { display: "flex", alignItems: "center", gap: 12 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    color: "var(--text)",
    fontSize: 16,
    flexShrink: 0,
  },
  who: { flex: 1, minWidth: 0 },
  name: { fontWeight: 700, fontSize: 16 },
  amount: { fontWeight: 800, fontSize: 18 },
  badgeUnpaid: {
    display: "inline-block",
    marginTop: 2,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--warning)",
  },
  badgePaid: {
    display: "inline-block",
    marginTop: 2,
    fontSize: 12,
    fontWeight: 700,
    color: "var(--success)",
  },
  lines: { listStyle: "none", padding: 0, margin: "12px 0 0" },
  line: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    fontSize: 14,
    padding: "4px 0",
  },
  lineMuted: { color: "var(--text-dim)" },
  lineName: { display: "flex", flexDirection: "column", paddingRight: 12 },
  lineAmt: { fontVariantNumeric: "tabular-nums" },
  shared: { color: "var(--text-dim)", fontSize: 12, marginTop: 2 },
  pay: { marginTop: 14, display: "flex", flexDirection: "column", gap: 8 },
  payBtn: {
    display: "block",
    textAlign: "center",
    background: "var(--primary)",
    color: "var(--on-primary)",
    fontWeight: 700,
    padding: "10px 14px",
    borderRadius: 12,
  },
  zelle: { color: "var(--text-dim)", fontSize: 14, textAlign: "center" },
  totals: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 18,
    padding: 16,
    marginTop: 16,
  },
  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "4px 0",
    color: "var(--text-dim)",
    fontSize: 15,
  },
  totalRowStrong: {
    color: "var(--text)",
    fontWeight: 800,
    fontSize: 18,
    borderTop: "1px solid var(--border)",
    marginTop: 6,
    paddingTop: 10,
  },
  receiptWrap: { marginTop: 16, textAlign: "center" },
  receipt: { maxWidth: "100%", borderRadius: 18, border: "1px solid var(--border)" },
  footer: {
    textAlign: "center",
    marginTop: 28,
  },
  coffee: {
    display: "inline-block",
    color: "var(--primary)",
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 8,
  },
  footerNote: { color: "var(--text-dim)", fontSize: 13 },
};
