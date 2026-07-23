// Saved contacts: everyone you've added to past splits, plus people you add
// manually or import from your iPhone address book. View, edit, or delete them.
import React, { useRef, useState } from "react";
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Person, SavedReceipt } from "../types";
import { formatPhone } from "../util";
import { pickContact } from "../contacts";
import { computeBreakdown, toDollars } from "../split";
import {
  Avatar,
  AvatarNameRow,
  AvatarStyleControls,
  Button,
  Card,
  Field,
  Icon,
  SwipeRow,
  SwipeRowHandle,
} from "../ui";
import { colors, personColors, radius, spacing } from "../theme";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function ContactsScreen({
  contacts,
  history,
  onAdd,
  onUpdate,
  onDelete,
  onOpenBill,
  onBack,
}: {
  contacts: Person[];
  history: SavedReceipt[];
  onAdd: (p: Person) => void;
  onUpdate: (p: Person) => void;
  onDelete: (id: string) => void;
  onOpenBill: (billId: string) => void;
  onBack: () => void;
}) {
  // Bills this contact was part of (by durable link, or name fallback), with the
  // participant + their share for that bill.
  const matches = (p: Person, c: Person) =>
    p.contactId
      ? p.contactId === c.id
      : p.name.trim().toLowerCase() === c.name.trim().toLowerCase();
  const billsFor = (c: Person) =>
    history
      .filter((r) => r.bill.people.some((p) => matches(p, c)))
      .map((r) => {
        const bd = computeBreakdown(r.bill);
        const pb = bd.perPerson.find((x) => matches(x.person, c));
        const unpaid = r.unpaid ?? [];
        return {
          r,
          shareCents: pb?.totalCents ?? 0,
          owes: pb ? unpaid.includes(pb.person.id) : false,
        };
      });

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, SwipeRowHandle | null>>({});
  const [editing, setEditing] = useState<Person | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(personColors[0]);
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  const openEdit = (p: Person) => {
    setEditing(p);
    setCreating(false);
    setName(p.name);
    setPhone(formatPhone(p.phone ?? ""));
    setEmoji(p.emoji ?? "");
    setColor(p.color || personColors[0]);
    setPhoto(p.photo);
  };
  const openNew = () => {
    setCreating(true);
    setEditing(null);
    setName("");
    setPhone("");
    setEmoji("");
    setColor(personColors[0]);
    setPhoto(undefined);
  };
  const close = () => {
    setEditing(null);
    setCreating(false);
  };
  const save = () => {
    const name2 = name.trim();
    const patch = {
      name: name2,
      phone: phone.trim() || undefined,
      emoji: emoji || undefined,
      color,
      photo,
    };
    if (creating) {
      if (name2) onAdd({ id: "", ...patch } as Person);
    } else if (editing) {
      onUpdate({ ...editing, ...patch, name: name2 || editing.name });
    }
    close();
  };

  const importFromContacts = async () => {
    const c = await pickContact();
    if (!c) return;
    onAdd({ id: "", color: "", name: c.name, phone: c.phone, photo: c.photo } as Person);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.h1}>Contacts</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.actions}>
        <Button title="Add Manually" onPress={openNew} variant="secondary" style={{ flex: 1 }} />
        {Platform.OS !== "web" && (
          <Button title="Import from Contacts" onPress={importFromContacts} style={{ flex: 1 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        {contacts.length === 0 ? (
          <Text style={styles.empty}>
            No saved contacts yet. Add someone, import from your phone, or add
            people to a split — they're saved here automatically.
          </Text>
        ) : (
          contacts.map((p) => {
            const bills = billsFor(p);
            const open = expandedId === p.id;
            // Sum of their still-unpaid shares across all bills — what they owe me.
            const owedCents = bills.reduce((s, b) => s + (b.owes ? b.shareCents : 0), 0);
            return (
              <SwipeRow
                key={p.id}
                ref={(el) => {
                  rowRefs.current[p.id] = el;
                }}
                onDelete={() => onDelete(p.id)}
                onOpen={() => {
                  // Swiping open while expanded → collapse.
                  if (open) {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    setExpandedId(null);
                  }
                }}
                style={{ marginBottom: spacing(1.5) }}
              >
                <Card>
                  <View style={styles.row}>
                    <Pressable
                      onPress={() => {
                        // Expanding while swiped open → close the delete.
                        rowRefs.current[p.id]?.close();
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId(open ? null : p.id);
                      }}
                      style={styles.rowMain}
                    >
                      <Avatar name={p.name} color={p.color} emoji={p.emoji} photo={p.photo} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name}>{p.name}</Text>
                        <Text style={styles.phone}>
                          {p.phone || "No phone"}
                          {bills.length > 0 ? `  ·  ${bills.length} split${bills.length === 1 ? "" : "s"}` : ""}
                        </Text>
                        {owedCents > 0 && (
                          <Text style={styles.owes}>Owes you ${toDollars(owedCents)}</Text>
                        )}
                      </View>
                      <Text style={styles.chevron}>{open ? "▾" : "▸"}</Text>
                    </Pressable>
                  </View>

                  {open && (
                    <View style={styles.detail}>
                      {bills.length === 0 ? (
                        <Text style={styles.noBills}>No splits with {p.name.split(" ")[0]} yet.</Text>
                      ) : (
                        bills.map(({ r, shareCents, owes }) => (
                          <Pressable
                            key={r.id}
                            style={styles.billRow}
                            onPress={() => onOpenBill(r.id)}
                            hitSlop={4}
                          >
                            <View style={styles.billNameWrap}>
                              <Text style={styles.billDate} numberOfLines={1}>
                                {r.bill.name || formatDate(r.dateISO)}
                              </Text>
                              <Icon name="external-link" size={12} color={colors.textDim} />
                            </View>
                            {owes && <Text style={styles.billDue}>Owed</Text>}
                            <Text style={styles.billShare}>${toDollars(shareCents)}</Text>
                          </Pressable>
                        ))
                      )}
                      <View style={styles.detailActions}>
                        <Pressable onPress={() => openEdit(p)} hitSlop={6}>
                          <Text style={styles.editLink}>Edit contact</Text>
                        </Pressable>
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
        visible={!!editing || creating}
        transparent
        animationType="slide"
        onRequestClose={close}
      >
        <Pressable style={styles.modalWrap} onPress={close}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              automaticallyAdjustKeyboardInsets
              keyboardDismissMode="interactive"
              contentContainerStyle={{ paddingBottom: spacing(2) }}
            >
              <Text style={styles.sheetTitle}>{creating ? "New contact" : "Edit contact"}</Text>
              <AvatarNameRow
                name={name}
                onName={setName}
                color={color}
                emoji={emoji}
                photo={photo}
                onPhoto={setPhoto}
                autoFocus={creating}
              />
              <Text style={styles.label}>Phone</Text>
              <Field value={phone} onChangeText={(t) => setPhone(formatPhone(t))} placeholder="(555) 123-4567" keyboardType="phone-pad" />
              <AvatarStyleControls
                color={color}
                onColor={setColor}
                emoji={emoji}
                onEmoji={setEmoji}
                photo={photo}
                onRemovePhoto={() => setPhoto(undefined)}
              />
              <Button title="Save" onPress={save} disabled={!name.trim()} style={{ marginTop: spacing(2) }} />
              <Button title="Cancel" onPress={close} variant="ghost" />
            </ScrollView>
          </Pressable>
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
  actions: { flexDirection: "row", gap: spacing(1), paddingHorizontal: spacing(2), marginBottom: spacing(1) },
  empty: { color: colors.textDim, fontSize: 15, textAlign: "center", marginTop: spacing(6), lineHeight: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1.5) },
  rowMain: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), flex: 1 },
  name: { color: colors.text, fontSize: 17, fontWeight: "700" },
  phone: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  owes: { color: colors.warning, fontSize: 13, fontWeight: "700", marginTop: 2 },
  chevron: { color: colors.textDim, fontSize: 16, width: 18, textAlign: "right" },
  delete: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  detail: {
    marginTop: spacing(1.5),
    paddingTop: spacing(1.5),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  noBills: { color: colors.textDim, fontSize: 14 },
  billRow: { flexDirection: "row", alignItems: "center", gap: spacing(1), paddingVertical: spacing(0.5) },
  billNameWrap: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  billDate: { color: colors.text, fontSize: 14, flexShrink: 1 },
  billDue: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  billShare: { color: colors.text, fontSize: 14, fontWeight: "700" },
  detailActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing(1.5),
    paddingTop: spacing(1),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editLink: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrimSoft },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(2.5),
    maxHeight: "88%",
  },
  sheetTitle: { color: colors.text, fontSize: 22, fontWeight: "800", marginBottom: spacing(1) },
  previewRow: { flexDirection: "row", alignItems: "center", gap: spacing(2), marginBottom: spacing(1) },
  removePhoto: { color: colors.textDim, fontSize: 14 },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: colors.transparent },
  swatchOn: { borderColor: colors.text },
  label: { color: colors.textDim, fontSize: 14, marginTop: spacing(1.5), marginBottom: spacing(0.5) },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  emojiBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  emojiBtnOn: { borderColor: colors.primary },
  noneText: { color: colors.textDim, fontSize: 15, fontWeight: "700" },
});
