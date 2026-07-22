// History of completed splits. Swipe a row left to delete it; tap to expand the
// per-person breakdown; "Open" reopens the bill's final screen to tweak or
// re-send the text blast.
import React, { useRef, useState } from "react";
import { Image, LayoutAnimation, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Person, SavedReceipt } from "../types";
import { computeBreakdown, toDollars } from "../split";
import { Avatar, Button, Card, Icon, SwipeRow, SwipeRowHandle } from "../ui";
import { canShareBreakdown, shareBreakdown } from "../shareLink";
import { colors, radius, spacing } from "../theme";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function HistoryScreen({
  history,
  me,
  contacts,
  onOpen,
  onUpdate,
  onDelete,
  onBack,
}: {
  history: SavedReceipt[];
  me: Person;
  contacts: Person[];
  onOpen: (r: SavedReceipt) => void;
  onUpdate: (r: SavedReceipt) => void;
  onDelete: (id: string) => void;
  onBack: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, SwipeRowHandle | null>>({});

  // Resolve a bill participant to their live profile/contact (so an updated photo
  // shows in history), falling back to the bill's own snapshot if unlinked/deleted.
  const live = (p: Person): Person => {
    if (p.isMe || p.contactId === "me") return me;
    const c = contacts.find(
      (sp) =>
        (p.contactId && sp.id === p.contactId) ||
        sp.name.trim().toLowerCase() === p.name.trim().toLowerCase(),
    );
    return c ?? p;
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>History</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        {history.length === 0 ? (
          <Text style={styles.empty}>
            No splits yet. Finished splits show up here.
          </Text>
        ) : (
          history.map((r) => {
            const breakdown = computeBreakdown(r.bill);
            const open = expanded === r.id;
            const people = r.bill.people.length;
            const unpaid = r.unpaid ?? [];
            const owedPeople = breakdown.perPerson.filter(
              (pb) => !pb.person.isMe && unpaid.includes(pb.person.id),
            );
            const dueCents = owedPeople.reduce((s, pb) => s + pb.totalCents, 0);
            const hasOthers = breakdown.perPerson.some((pb) => !pb.person.isMe);
            const toggle = (pid: string) => {
              const next = unpaid.includes(pid)
                ? unpaid.filter((x) => x !== pid)
                : [...unpaid, pid];
              onUpdate({ ...r, unpaid: next });
            };
            return (
              <SwipeRow
                key={r.id}
                ref={(el) => {
                  rowRefs.current[r.id] = el;
                }}
                onDelete={() => onDelete(r.id)}
                onOpen={() => {
                  // Swiping open while expanded → collapse.
                  if (expanded === r.id) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpanded(null);
                  }
                }}
              >
                <Card>
                  <Pressable
                    onPress={() => {
                      // Expanding while swiped open → close the delete.
                      rowRefs.current[r.id]?.close();
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setExpanded(open ? null : r.id);
                    }}
                    style={styles.row}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.date}>{r.bill.name || formatDate(r.dateISO)}</Text>
                      <Text style={styles.meta}>
                        {r.bill.name ? `${formatDate(r.dateISO)} · ` : ""}
                        {people} {people === 1 ? "person" : "people"} ·{" "}
                        {r.bill.items.length} items
                      </Text>
                      {owedPeople.length > 0 && (
                        <Text style={styles.dueSmall}>
                          ${toDollars(dueCents)} due from {owedPeople.length}{" "}
                          {owedPeople.length === 1 ? "person" : "people"}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.total}>${toDollars(breakdown.grandTotalCents)}</Text>
                    <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
                  </Pressable>

                  {open && (
                    <View style={styles.detail}>
                      {hasOthers && (
                        <View style={styles.colHeaderRow}>
                          <View style={{ width: 26 }} />
                          <Text style={[styles.colHeader, { flex: 1 }]}>Person</Text>
                          <Text style={[styles.colHeader, styles.amountCol]}>Amount</Text>
                          <Text style={[styles.colHeader, styles.colPaid]}>Paid</Text>
                        </View>
                      )}
                      {breakdown.perPerson
                        .slice()
                        .sort((a, b) => b.totalCents - a.totalCents)
                        .map((pb) => {
                          const paid = !unpaid.includes(pb.person.id);
                          const lp = live(pb.person);
                          return (
                            <View key={pb.person.id} style={styles.personRow}>
                              <Avatar
                                name={lp.name}
                                color={lp.color}
                                emoji={lp.emoji}
                                photo={lp.photo}
                                size={26}
                              />
                              <Text style={styles.personName}>{lp.name}</Text>
                              <Text style={[styles.personTotal, styles.amountCol]}>
                                ${toDollars(pb.totalCents)}
                              </Text>
                              <View style={styles.checkCol}>
                                {!pb.person.isMe && (
                                  <Pressable
                                    onPress={() => toggle(pb.person.id)}
                                    hitSlop={8}
                                    style={[styles.check, paid && styles.checkOn]}
                                  >
                                    {paid && <Icon name="check" size={13} color="#fff" />}
                                  </Pressable>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      <View style={styles.actions}>
                        {canShareBreakdown() && (
                          <Pressable
                            onPress={() => shareBreakdown(r.bill).catch(() => {})}
                            hitSlop={8}
                            style={styles.shareBtn}
                          >
                            <Icon name="share-2" size={20} color={colors.primary} />
                          </Pressable>
                        )}
                        {r.receiptImage ? (
                          <Button
                            title="See receipt"
                            variant="secondary"
                            onPress={() => setViewingPhoto(r.receiptImage)}
                            style={{ flex: 1 }}
                          />
                        ) : null}
                        <Button title="Open bill" onPress={() => onOpen(r)} style={{ flex: 1 }} />
                      </View>
                    </View>
                  )}
                </Card>
              </SwipeRow>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!viewingPhoto}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <Pressable style={styles.photoWrap} onPress={() => setViewingPhoto(null)}>
          {viewingPhoto && (
            <Image source={{ uri: viewingPhoto }} style={styles.photoFull} resizeMode="contain" />
          )}
          <Text style={styles.photoClose}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing(2),
  },
  back: { color: colors.primary, fontSize: 17, fontWeight: "600" },
  h1: { color: colors.text, fontSize: 20, fontWeight: "800" },
  empty: { color: colors.textDim, fontSize: 15, textAlign: "center", marginTop: spacing(6) },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  date: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  total: { color: colors.text, fontSize: 18, fontWeight: "800" },
  chevron: { color: colors.textDim, fontSize: 16, width: 18, textAlign: "right" },
  detail: {
    marginTop: spacing(1.5),
    paddingTop: spacing(1.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), paddingVertical: spacing(0.5) },
  personName: { color: colors.text, fontSize: 15, flex: 1 },
  personTotal: { color: colors.text, fontSize: 15, fontWeight: "700" },
  dueSmall: { color: colors.warning, fontSize: 13, fontWeight: "700", marginTop: 2 },
  checkCol: { width: 40, alignItems: "center" },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkOn: { backgroundColor: colors.success, borderColor: colors.success },
  colHeaderRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), marginBottom: spacing(0.5) },
  colHeader: { color: colors.textDim, fontSize: 12, fontWeight: "700" },
  colPaid: { width: 40, textAlign: "center" },
  // Fixed width sized for "$999.99" so amounts line up, left-aligned.
  amountCol: { width: 68, textAlign: "left" },
  actions: { flexDirection: "row", alignItems: "stretch", gap: spacing(1), marginTop: spacing(1.5) },
  shareBtn: {
    width: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  photoWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoFull: { width: "92%", height: "80%" },
  photoClose: { color: "#fff", marginTop: spacing(2), fontSize: 15 },
});
