// Step 4: the breakdown — what each person owes, with an itemized view. From
// here you can fill in missing phone numbers and text everyone their total plus
// a Venmo link to pay you.
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Bill, Person } from "../types";
import { computeBreakdown, toDollars } from "../split";
import { sendGroupText } from "../sms";
import { promptText } from "../prompt";
import { canShareBreakdown, shareBreakdown } from "../shareLink";
import { shareBill, shortUrl, updateSharedBill } from "../backend";
import { Avatar, Button, Card, Icon } from "../ui";
import { colors, radius, spacing } from "../theme";

// For the group text: show first names, disambiguating collisions with a last
// initial — or the full last name if the initial also collides.
function textNames(people: Person[]): Record<string, string> {
  const parts = (n: string) => {
    const t = n.trim().split(/\s+/).filter(Boolean);
    return { first: t[0] ?? n.trim(), last: t.slice(1).join(" ") };
  };
  const names: Record<string, string> = {};
  for (const p of people) {
    const { first, last } = parts(p.name);
    const sharesFirst = people.filter(
      (q) => parts(q.name).first.toLowerCase() === first.toLowerCase(),
    );
    if (sharesFirst.length <= 1 || !last) {
      names[p.id] = first;
      continue;
    }
    const initial = last[0].toUpperCase();
    const sharesInitial = sharesFirst.filter((q) => {
      const ql = parts(q.name).last;
      return !!ql && ql[0].toUpperCase() === initial;
    });
    names[p.id] = sharesInitial.length <= 1 ? `${first} ${initial}` : `${first} ${last}`;
  }
  return names;
}

export function ResultsScreen({
  bill,
  me,
  receiptImage,
  fromHistory,
  shareId,
  shareEditToken,
  onShared,
  onUpdatePerson,
  onEdit,
  onRestart,
}: {
  bill: Bill;
  me: Person;
  receiptImage: string | null;
  fromHistory?: boolean;
  shareId?: string;
  shareEditToken?: string;
  onShared?: (shareId: string, editToken: string) => void;
  onUpdatePerson: (id: string, patch: Partial<Person>) => void;
  onEdit: () => void;
  onRestart: () => void;
}) {
  const breakdown = useMemo(() => computeBreakdown(bill), [bill]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(shareId ? shortUrl(shareId) : null);
  const [sharing, setSharing] = useState(false);

  // On opening the breakdown, get the short link ready: reuse the stored one (and
  // refresh its content in the background), or create it — with a spinner on the
  // Text/Share buttons — so we never surface the long URL.
  useEffect(() => {
    if (!canShareBreakdown()) return;
    if (shareId) {
      setShareUrl(shortUrl(shareId));
      if (shareEditToken) updateSharedBill(shareId, shareEditToken, { bill }).catch(() => {});
      return;
    }
    let cancelled = false;
    setSharing(true);
    shareBill(bill)
      .then(({ id, editToken }) => {
        if (cancelled) return;
        setShareUrl(shortUrl(id));
        onShared?.(id, editToken);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSharing(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Native prompt floats above the keyboard, so it can't bury the field.
  const openPhone = (p: Person) => {
    promptText(
      p.phone ? `${p.name}'s phone` : `Add ${p.name}'s phone`,
      "Used to text total amounts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save",
          onPress: (text?: string) => onUpdatePerson(p.id, { phone: (text ?? "").trim() || undefined }),
        },
      ],
      "plain-text",
      p.phone ?? "",
      "phone-pad",
    );
  };

  // Build one group message: each person's total, a link to the full breakdown,
  // and how to pay you (Venmo/Zelle).
  const buildBody = (shareUrl?: string) => {
    const owed = breakdown.perPerson
      .filter((pb) => !pb.person.isMe)
      .slice()
      .sort((a, b) => b.totalCents - a.totalCents);

    const names = textNames(owed.map((pb) => pb.person));
    const header = bill.name?.trim() ? `Split — ${bill.name.trim()}` : "Split summary";
    const lines = owed.map((pb) => `${names[pb.person.id]}: $${toDollars(pb.totalCents)}`);
    let body = `${header}\n${lines.join("\n")}`;

    const pay: string[] = [];
    if (me.venmo) pay.push(`Venmo: https://venmo.com/u/${me.venmo.replace(/^@/, "").trim()}`);
    if (me.zelle) pay.push(`Zelle: ${me.zelle.trim()}`);
    if (pay.length) body += `\n\nPay me —\n${pay.join("\n")}`;

    if (shareUrl) body += `\n\nFull breakdown: ${shareUrl}`;
    return body;
  };

  const textEveryone = () => {
    const recipients = bill.people
      .filter((p) => !p.isMe && p.phone)
      .map((p) => p.phone as string);
    const missing = bill.people.filter((p) => !p.isMe && !p.phone);

    if (recipients.length === 0) {
      Alert.alert(
        "No phone numbers",
        "Add a phone number to at least one person to text them their total.",
      );
      return;
    }

    // The short link is pre-generated when the screen opens; use it directly.
    const send = () => sendGroupText(recipients, buildBody(shareUrl ?? undefined));
    const proceed = () => {
      if (!me.venmo && !me.zelle) {
        Alert.alert(
          "No payment method",
          "Add your Venmo or Zelle in your profile so people know how to pay you.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Text without it", onPress: send },
          ],
        );
        return;
      }
      send();
    };

    // Warn about anyone who'll be left out because they have no phone number.
    if (missing.length > 0) {
      const names = missing.map((p) => p.name).join(", ");
      const verb = missing.length === 1 ? "doesn't have a phone number" : "don't have phone numbers";
      Alert.alert(
        "Missing phone numbers",
        `${names} ${verb} and won't get a text. Add their number first, or text everyone else?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Text the rest", onPress: proceed },
        ],
      );
      return;
    }

    proceed();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(12) }}
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Breakdown</Text>
            {bill.name ? <Text style={styles.subName}>{bill.name}</Text> : null}
          </View>
          {receiptImage && (
            <Pressable onPress={() => setViewingPhoto(true)} hitSlop={8} style={styles.viewPhotoBtn}>
              <Icon name="file-text" size={14} color={colors.primary} />
              <Text style={styles.viewPhoto}>Receipt</Text>
            </Pressable>
          )}
        </View>

        <Card style={{ marginTop: spacing(2), backgroundColor: colors.surfaceAlt }}>
          <SummaryRow label="Subtotal" value={breakdown.subtotalCents} />
          <SummaryRow label="Tax" value={breakdown.taxCents} />
          <SummaryRow label="Tip" value={breakdown.tipCents} />
          <View style={styles.divider} />
          <SummaryRow label="Total" value={breakdown.grandTotalCents} bold />
        </Card>

        {breakdown.unassignedItems.length > 0 && (
          <View style={styles.warnBox}>
            <Text style={styles.warnText}>
              Not counted (nobody claimed):{" "}
              {breakdown.unassignedItems.map((i) => i.name).join(", ")}
            </Text>
          </View>
        )}

        <Text style={[styles.h2, { marginTop: spacing(3) }]}>Each person owes</Text>

        {breakdown.perPerson
          .slice()
          .sort((a, b) => b.totalCents - a.totalCents)
          .map((pb) => {
            const open = expanded === pb.person.id;
            return (
              <Card key={pb.person.id} style={{ marginTop: spacing(1.5) }}>
                <Pressable
                  onPress={() => setExpanded(open ? null : pb.person.id)}
                  style={styles.personRow}
                >
                  <Avatar
                    name={pb.person.name}
                    color={pb.person.color}
                    emoji={pb.person.emoji}
                    photo={pb.person.photo}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.personName}>{pb.person.name}</Text>
                    {!pb.person.isMe && (
                      pb.person.phone ? (
                        <Text style={styles.personPhone}>{pb.person.phone}</Text>
                      ) : (
                        <Pressable onPress={() => openPhone(pb.person)} hitSlop={6} style={styles.addPhoneBtn}>
                          <Icon name="plus" size={13} color={colors.primary} />
                          <Text style={styles.addPhone}>Add phone</Text>
                        </Pressable>
                      )
                    )}
                  </View>
                  <Text style={styles.personTotal}>${toDollars(pb.totalCents)}</Text>
                  <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
                </Pressable>

                {open && (
                  <View style={styles.detail}>
                    {pb.lines.map((line, i) => (
                      <View key={i} style={styles.detailRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.detailItem}>{line.item.name}</Text>
                          {line.sharedWith > 1 && (
                            <Text style={styles.detailShare}>
                              ${line.item.price.toFixed(2)} split {line.sharedWith} ways
                            </Text>
                          )}
                        </View>
                        <Text style={styles.detailAmt}>
                          ${toDollars(line.shareCents)}
                        </Text>
                      </View>
                    ))}
                    <View style={styles.detailDivider} />
                    <MiniRow label="Items" cents={pb.subtotalCents} />
                    <MiniRow label="Tax share" cents={pb.taxCents} />
                    <MiniRow label="Tip share" cents={pb.tipCents} />
                    {pb.person.phone && (
                      <Pressable onPress={() => openPhone(pb.person)} hitSlop={6}>
                        <Text style={styles.editPhone}>Edit phone</Text>
                      </Pressable>
                    )}
                  </View>
                )}
              </Card>
            );
          })}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Text everyone their total" onPress={textEveryone} loading={sharing} />
        <View style={styles.footerLinks}>
          <Pressable onPress={onEdit} hitSlop={8} style={[styles.footerLinkRow, styles.linkLeft]}>
            <Icon name="edit-2" size={14} color={colors.primary} />
            <Text style={styles.footerLink}>Edit bill</Text>
          </Pressable>
          {canShareBreakdown() && (
            <Pressable
              onPress={() => shareBreakdown(bill, shareUrl ?? undefined).catch(() => {})}
              hitSlop={12}
              style={styles.linkCenter}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Icon name="share-2" size={20} color={colors.primary} />
              )}
            </Pressable>
          )}
          <Pressable onPress={onRestart} hitSlop={8} style={styles.linkRight}>
            <Text style={styles.footerLink}>{fromHistory ? "Done" : "New split"}</Text>
          </Pressable>
        </View>
      </View>

      <Modal
        visible={viewingPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(false)}
      >
        <Pressable style={styles.photoWrap} onPress={() => setViewingPhoto(false)}>
          {receiptImage && (
            <Image
              source={{ uri: receiptImage }}
              style={styles.photoFull}
              resizeMode="contain"
            />
          )}
          <Text style={styles.photoClose}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, bold && styles.summaryBold]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, bold && styles.summaryBold]}>
        ${toDollars(value)}
      </Text>
    </View>
  );
}

function MiniRow({ label, cents }: { label: string; cents: number }) {
  return (
    <View style={styles.miniRow}>
      <Text style={styles.miniLabel}>{label}</Text>
      <Text style={styles.miniValue}>${toDollars(cents)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { color: colors.text, fontSize: 28, fontWeight: "800" },
  subName: { color: colors.textDim, fontSize: 15, fontWeight: "600", marginTop: 2 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing(1),
  },
  viewPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewPhoto: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  photoWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "92%", height: "80%" },
  photoClose: { color: "#fff", marginTop: spacing(2), fontSize: 15 },
  h2: { color: colors.text, fontSize: 18, fontWeight: "700" },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing(0.75),
  },
  summaryLabel: { color: colors.textDim, fontSize: 16 },
  summaryValue: { color: colors.text, fontSize: 16 },
  summaryBold: { color: colors.text, fontWeight: "800", fontSize: 20 },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing(0.5),
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  personName: { color: colors.text, fontSize: 17, fontWeight: "700" },
  personPhone: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  addPhoneBtn: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  addPhone: { color: colors.primary, fontSize: 13, fontWeight: "600" },
  editPhone: { color: colors.primary, fontSize: 13, fontWeight: "600", marginTop: spacing(1) },
  personTotal: { color: colors.success, fontSize: 20, fontWeight: "800" },
  chevron: { color: colors.textDim, fontSize: 16, width: 18, textAlign: "right" },
  detail: {
    marginTop: spacing(1.5),
    paddingTop: spacing(1.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing(0.5),
  },
  detailItem: { color: colors.text, fontSize: 15 },
  detailShare: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  detailAmt: { color: colors.text, fontSize: 15, fontWeight: "600" },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing(1),
  },
  miniRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  miniLabel: { color: colors.textDim, fontSize: 14 },
  miniValue: { color: colors.textDim, fontSize: 14 },
  warnBox: {
    marginTop: spacing(2),
    padding: spacing(1.5),
    borderRadius: radius.md,
    backgroundColor: colors.warningTint,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  warnText: { color: "#9A3412", fontSize: 14 },
  footer: {
    padding: spacing(2),
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  footerLinks: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing(3),
    paddingHorizontal: spacing(0.5),
  },
  linkLeft: { flex: 1 },
  linkCenter: { paddingHorizontal: spacing(1) },
  linkRight: { flex: 1, alignItems: "flex-end" },
  footerLinkRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footerLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(2.5),
  },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: spacing(1.5) },
});
