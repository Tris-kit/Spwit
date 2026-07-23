// The workhorse screen. Assignment model: pick the active person at the bottom,
// then tap items to assign them to that person. Tap the gear on a row to reveal
// edit actions (rename / re-price / split); swipe a row left to delete it.
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Assignments, Item, Person } from "../types";
import { splitEqually, toCents } from "../split";
import { pickContact } from "../contacts";
import { Avatar, Button, Card, Field, Icon, PersonTray, PrefixField, SwipeRow, type PersonDraft } from "../ui";
import { makeId } from "../util";
import { colors, personColors, radius, spacing } from "../theme";

// The per-item edit actions that crossfade in when the ⋯ is tapped and out when
// dismissed. Gear and icons are overlaid; opacity animates between them.
function RowActions({
  active,
  onOpen,
  onSplit,
  onDone,
}: {
  active: boolean;
  onOpen: () => void;
  onSplit: () => void;
  onDone: () => void;
}) {
  const v = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: active ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [active, v]);

  return (
    <View style={raStyles.wrap}>
      <Animated.View
        style={[raStyles.gearWrap, { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        pointerEvents={active ? "none" : "auto"}
      >
        <Pressable onPress={onOpen} hitSlop={10} style={raStyles.gear}>
          <Icon name="more-horizontal" size={20} color={colors.textDim} />
        </Pressable>
      </Animated.View>
      <Animated.View style={[raStyles.icons, { opacity: v }]} pointerEvents={active ? "auto" : "none"}>
        <Pressable onPress={onSplit} hitSlop={8} style={raStyles.btn}>
          <Icon name="divide" size={16} color={colors.primary} />
        </Pressable>
        <Pressable onPress={onDone} hitSlop={8} style={[raStyles.btn, raStyles.btnDone]}>
          <Icon name="check" size={16} color={colors.onPrimary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const raStyles = StyleSheet.create({
  wrap: { width: 76, height: 34, justifyContent: "center", alignItems: "flex-end" },
  gearWrap: { position: "absolute", right: 0, top: 0, bottom: 0, justifyContent: "center" },
  gear: { paddingHorizontal: spacing(0.5) },
  icons: { flexDirection: "row", alignItems: "center", gap: spacing(0.75) },
  btn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDone: { backgroundColor: colors.primary, borderColor: colors.primary },
});

export function BuildScreen({
  items,
  setItems,
  people,
  setPeople,
  assignments,
  setAssignments,
  savedProfiles,
  onEnsureContact,
  receiptImage,
  billName,
  setBillName,
  onBack,
  onNext,
}: {
  items: Item[];
  setItems: (i: Item[]) => void;
  people: Person[];
  setPeople: (p: Person[]) => void;
  assignments: Assignments;
  setAssignments: (a: Assignments) => void;
  savedProfiles: Person[];
  onEnsureContact: (p: Person) => string;
  receiptImage: string | null;
  billName: string;
  setBillName: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editPriceText, setEditPriceText] = useState(""); // price buffer for the row being edited
  const [splitItem, setSplitItem] = useState<Item | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState(false);
  // Track people-row scroll geometry to hint when more people are off-screen.
  const peopleRef = useRef<ScrollView>(null);
  const titleRef = useRef<TextInput>(null);
  const [peopleScroll, setPeopleScroll] = useState({ x: 0, w: 0, c: 0 });
  const showPeopleHint =
    peopleScroll.c > peopleScroll.w + 8 &&
    peopleScroll.x < peopleScroll.c - peopleScroll.w - 8;

  // "Hold to edit" hint: shown briefly when you tap the person you're already on.
  const tip = useRef(new Animated.Value(0)).current;
  const [tipVisible, setTipVisible] = useState(false);
  const showEditTip = () => {
    setTipVisible(true);
    tip.setValue(0);
    Animated.sequence([
      Animated.timing(tip, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(tip, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setTipVisible(false);
    });
  };

  // Add / edit-person tray (shared PersonTray component)
  const [personTrayOpen, setPersonTrayOpen] = useState(false);
  const [personTrayInitial, setPersonTrayInitial] = useState<Person | null>(null);

  const active = activeId ?? people[0]?.id ?? null;
  const activePerson = people.find((p) => p.id === active);
  const editingIsMe = !!personTrayInitial?.isMe;

  // --- assignment: tap item to toggle the active person on it -----------
  const toggleAssign = (itemId: string) => {
    if (editingRowId) setEditingRowId(null); // tapping elsewhere dismisses row actions
    if (!active) return;
    const cur = assignments[itemId] ?? [];
    setAssignments({
      ...assignments,
      [itemId]: cur.includes(active)
        ? cur.filter((id) => id !== active)
        : [...cur, active],
    });
  };

  // --- item add/edit (inline, like the bill title) ----------------------
  const enterEdit = (item: Item) => {
    setEditingRowId(item.id);
    setEditPriceText(item.price ? String(item.price) : "");
  };
  const exitEdit = () => {
    // Blank names fall back to "Item".
    setItems(items.map((i) => (i.id === editingRowId ? { ...i, name: i.name.trim() || "Item" } : i)));
    setEditingRowId(null);
  };
  const openAddItem = () => {
    const id = makeId("item");
    setItems([...items, { id, name: "", price: 0 }]);
    setEditingRowId(id);
    setEditPriceText("");
  };
  const renameItem = (id: string, name: string) =>
    setItems(items.map((i) => (i.id === id ? { ...i, name } : i)));
  const changePrice = (id: string, text: string) => {
    setEditPriceText(text);
    const p = parseFloat(text.replace(/[^0-9.]/g, "")) || 0;
    setItems(items.map((i) => (i.id === id ? { ...i, price: p } : i)));
  };

  const openSplit = (item: Item) => {
    setEditingRowId(null);
    setSplitItem(item);
  };
  const doSplit = (n: number) => {
    const item = splitItem;
    if (item && n >= 2) {
      // Divide the price into exact cents so the parts sum to the original.
      const parts = splitEqually(toCents(item.price), n);
      const newItems: Item[] = parts.map((c, k) => ({
        id: makeId("item"),
        name: `${item.name} (${k + 1}/${n})`,
        price: c / 100,
      }));
      const idx = items.findIndex((i) => i.id === item.id);
      const next = [...items];
      next.splice(idx, 1, ...newItems);
      setItems(next);
      const a = { ...assignments };
      delete a[item.id];
      setAssignments(a);
    }
    setSplitItem(null);
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    const a = { ...assignments };
    delete a[id];
    setAssignments(a);
    if (editingRowId === id) setEditingRowId(null);
  };

  // --- people (shared PersonTray) ---------------------------------------
  const closePersonTray = () => {
    setPersonTrayOpen(false);
    setPersonTrayInitial(null);
  };
  const openAddPerson = () => {
    setEditingRowId(null);
    setPersonTrayInitial(null);
    setPersonTrayOpen(true);
  };
  const openEditPerson = (p: Person) => {
    setEditingRowId(null);
    setPersonTrayInitial(p);
    setPersonTrayOpen(true);
  };
  const savePerson = (data: PersonDraft) => {
    if (personTrayInitial) {
      setPeople(people.map((p) => (p.id === personTrayInitial.id ? { ...p, ...data } : p)));
    } else {
      const base: Person = { id: makeId("person"), ...data };
      const person = { ...base, contactId: onEnsureContact(base) };
      setPeople([...people, person]);
      setActiveId(person.id);
    }
    closePersonTray();
  };
  const quickAdd = (profile: Person) => {
    // Link this bill participant to the existing saved contact.
    const person = { ...profile, id: makeId("person"), contactId: profile.id };
    setPeople([...people, person]);
    setActiveId(person.id);
    closePersonTray();
  };
  const importPerson = async () => {
    const c = await pickContact();
    if (!c) return;
    const base: Person = {
      id: makeId("person"),
      name: c.name,
      phone: c.phone,
      photo: c.photo,
      color: personColors[people.length % personColors.length],
    };
    const person = { ...base, contactId: onEnsureContact(base) };
    setPeople([...people, person]);
    setActiveId(person.id);
    closePersonTray();
  };
  const removePerson = () => {
    const p = personTrayInitial;
    if (!p) return;
    setPeople(people.filter((x) => x.id !== p.id));
    const next: Assignments = {};
    for (const [itemId, ids] of Object.entries(assignments)) {
      next[itemId] = ids.filter((id) => id !== p.id);
    }
    setAssignments(next);
    if (active === p.id) setActiveId(null);
    closePersonTray();
  };

  const total = items.reduce((s, i) => s + i.price, 0);
  const unassigned = items.filter((i) => (assignments[i.id] ?? []).length === 0).length;

  // Block advancing until every item is claimed by someone.
  const handleNext = () => {
    if (unassigned > 0) {
      Alert.alert(
        "Assign every item",
        `${unassigned} item${unassigned > 1 ? "s still need" : " still needs"} to be claimed before you can continue.`,
      );
      return;
    }
    onNext();
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        <View style={styles.headerRow}>
          <View style={styles.titleBtn}>
            <TextInput
              ref={titleRef}
              style={[styles.h1, styles.titleInput]}
              value={billName}
              onChangeText={setBillName}
              placeholder="Name this bill"
              placeholderTextColor={colors.textDim}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Pressable onPress={() => titleRef.current?.focus()} hitSlop={10}>
              <Icon name="edit-2" size={15} color={colors.textDim} />
            </Pressable>
          </View>
        </View>
        <View style={styles.metaRow}>
          <Text style={styles.total}>${total.toFixed(2)}</Text>
          {receiptImage && (
            <Pressable onPress={() => setViewingPhoto(true)} hitSlop={8} style={styles.viewPhotoBtn}>
              <Icon name="file-text" size={14} color={colors.primary} />
              <Text style={styles.viewPhoto}>Receipt</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.sub}>
          {activePerson
            ? `Tap items ${activePerson.isMe ? "you" : activePerson.name.split(" ")[0]} had. Use the icons to edit, or swipe a row left to delete.`
            : "Add someone below, then tap the items they had."}
        </Text>

        {items.map((item) => {
          const sharers = assignments[item.id] ?? [];
          const mine = active ? sharers.includes(active) : false;
          const each = sharers.length > 1 ? item.price / sharers.length : null;
          const editing = editingRowId === item.id;
          return (
            <SwipeRow key={item.id} onDelete={() => deleteItem(item.id)}>
              <Pressable
                onPress={() => {
                  if (!editing) toggleAssign(item.id);
                }}
                style={[styles.itemRow, mine && styles.itemRowActive]}
              >
                <View style={{ flex: 1 }}>
                  {editing ? (
                    <View style={{ gap: spacing(1) }}>
                      <Field
                        value={item.name}
                        onChangeText={(t) => renameItem(item.id, t)}
                        placeholder="Item name"
                        autoCapitalize="words"
                        autoFocus
                      />
                      <PrefixField
                        prefix="$"
                        value={editPriceText}
                        onChangeText={(t) => changePrice(item.id, t)}
                        placeholder="0.00"
                        keyboardType="decimal-pad"
                      />
                    </View>
                  ) : (
                    <>
                      <Text style={styles.itemName}>{item.name}</Text>
                      {sharers.length === 0 ? (
                        <Text style={styles.unassigned}>Unassigned</Text>
                      ) : (
                        <View style={styles.sharerRow}>
                          {sharers.map((id) => {
                            const sp = people.find((p) => p.id === id);
                            return sp ? (
                              <Avatar key={id} name={sp.name} color={sp.color} emoji={sp.emoji} photo={sp.photo} size={20} />
                            ) : null;
                          })}
                          {each && <Text style={styles.eachText}>${each.toFixed(2)} each</Text>}
                        </View>
                      )}
                    </>
                  )}
                </View>
                {!editing && (
                  <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                )}
                <RowActions
                  active={editing}
                  onOpen={() => enterEdit(item)}
                  onSplit={() => openSplit(item)}
                  onDone={exitEdit}
                />
              </Pressable>
            </SwipeRow>
          );
        })}

        <Pressable onPress={openAddItem} style={styles.addItem}>
          <Icon name="plus" size={16} color={colors.primary} />
          <Text style={styles.addItemText}>Add item</Text>
        </Pressable>
      </ScrollView>

      {/* footer: active-person selector + next */}
      <View style={styles.footer}>
        {unassigned > 0 && (
          <Text style={styles.warn}>
            {unassigned} item{unassigned > 1 ? "s" : ""} unassigned
          </Text>
        )}
        <View>
          {tipVisible && (
            <Animated.View style={[styles.tipRow, { opacity: tip }]} pointerEvents="none">
              <View style={styles.tipBubble}>
                <Text style={styles.tipText}>Hold to edit</Text>
              </View>
            </Animated.View>
          )}
          <ScrollView
            ref={peopleRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onLayout={(e) => {
              const w = e?.nativeEvent?.layout?.width;
              if (typeof w === "number") setPeopleScroll((s) => ({ ...s, w }));
            }}
            onContentSizeChange={(w) => setPeopleScroll((s) => ({ ...s, c: w }))}
            onScroll={(e) => {
              const x = e?.nativeEvent?.contentOffset?.x;
              if (typeof x === "number") setPeopleScroll((s) => ({ ...s, x }));
            }}
            contentContainerStyle={{ gap: spacing(1.5), paddingVertical: spacing(0.5), paddingRight: spacing(4) }}
          >
            {people.map((p) => {
              const isActive = active === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    setEditingRowId(null);
                    // Tapping the person you're already on does nothing useful —
                    // hint that a long-press edits them instead.
                    if (isActive) showEditTip();
                    else setActiveId(p.id);
                  }}
                  onLongPress={() => openEditPerson(p)}
                  style={styles.personChip}
                >
                  <Avatar name={p.name} color={p.color} emoji={p.emoji} photo={p.photo} size={44} selected={isActive} />
                  <Text style={[styles.personName, isActive && styles.personNameActive]} numberOfLines={1}>
                    {p.isMe ? "You" : p.name.split(" ")[0]}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable onPress={openAddPerson} style={styles.personChip}>
              <View style={styles.addCircle}>
                <Icon name="plus" size={22} color={colors.primary} />
              </View>
              <Text style={styles.personName}>Add</Text>
            </Pressable>
          </ScrollView>
          {showPeopleHint && (
            <Pressable
              style={styles.scrollHint}
              onPress={() =>
                peopleRef.current?.scrollTo({ x: peopleScroll.x + 160, animated: true })
              }
            >
              <Text style={styles.scrollHintText}>›</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: spacing(1), marginTop: spacing(1) }}>
          <Button title="Back" onPress={onBack} variant="secondary" style={{ flex: 1 }} />
          <Button
            title="Next: Tax & Tip"
            onPress={handleNext}
            disabled={items.length === 0 || people.length === 0}
            style={{ flex: 2 }}
          />
        </View>
      </View>

      {/* ---- Photo viewer ---- */}
      <Modal visible={viewingPhoto} transparent animationType="fade" onRequestClose={() => setViewingPhoto(false)}>
        <Pressable style={styles.photoWrap} onPress={() => setViewingPhoto(false)}>
          {receiptImage && (
            <Image source={{ uri: receiptImage }} style={styles.photoFull} resizeMode="contain" />
          )}
          <Text style={styles.photoClose}>Tap to close</Text>
        </Pressable>
      </Modal>

      {/* ---- Add / edit person (shared tray) ---- */}
      <PersonTray
        visible={personTrayOpen}
        initial={personTrayInitial}
        defaultColor={personColors[people.length % personColors.length]}
        savedProfiles={savedProfiles}
        excludeNames={people.map((p) => p.name)}
        onQuickAdd={quickAdd}
        showImport={Platform.OS !== "web"}
        onImport={importPerson}
        canDelete={!editingIsMe}
        onDelete={removePerson}
        onSave={savePerson}
        onClose={closePersonTray}
      />

      {/* Split — button-only, no keyboard */}
      <Modal visible={!!splitItem} transparent animationType="fade" onRequestClose={() => setSplitItem(null)}>
        <Pressable style={styles.splitWrap} onPress={() => setSplitItem(null)}>
          <Pressable style={styles.splitCard} onPress={() => {}}>
            <Text style={styles.splitTitle}>Divide into…</Text>
            <View style={styles.splitBtns}>
              {[2, 3, 4].map((n) => (
                <Pressable key={n} style={styles.splitChoice} onPress={() => doSplit(n)}>
                  <Text style={styles.splitChoiceText}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Cancel" variant="ghost" onPress={() => setSplitItem(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing(1) },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800", flexShrink: 1 },
  titleInput: { flex: 1, paddingVertical: 0 },
  h1Placeholder: { color: colors.textDim },
  viewPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewPhoto: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  total: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing(1.5),
    marginTop: spacing(0.5),
  },
  sub: { color: colors.textDim, fontSize: 14, marginTop: spacing(1), marginBottom: spacing(1.5) },
  tipRow: { position: "absolute", top: -30, left: 0, right: 0, alignItems: "center", zIndex: 20 },
  tipBubble: {
    backgroundColor: colors.text,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  tipText: { color: colors.onPrimary, fontSize: 12, fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(1.25),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(1.75),
  },
  itemRowActive: { borderColor: colors.primary, backgroundColor: colors.surfaceAlt },
  itemName: { color: colors.text, fontSize: 18, fontWeight: "700" },
  itemPrice: { color: colors.text, fontSize: 18, fontWeight: "700" },
  unassigned: { color: colors.textDim, fontSize: 12, marginTop: 3 },
  sharerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5 },
  eachText: { color: colors.textDim, fontSize: 12, marginLeft: 4 },
  gear: { paddingLeft: spacing(0.5) },
  iconRow: { flexDirection: "row", alignItems: "center", gap: spacing(0.75), paddingLeft: spacing(0.5) },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  addItem: {
    flexDirection: "row",
    gap: 6,
    padding: spacing(2),
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing(0.5),
  },
  addItemText: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
    padding: spacing(2),
  },
  warn: { color: colors.warning, fontSize: 13, marginBottom: spacing(0.5) },
  scrollHint: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 34,
    alignItems: "flex-end",
    justifyContent: "center",
    backgroundColor: colors.bg,
    opacity: 0.92,
  },
  scrollHintText: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  personChip: { alignItems: "center", width: 60 },
  personName: { color: colors.textDim, fontSize: 12, marginTop: 4 },
  personNameActive: { color: colors.text, fontWeight: "700" },
  addCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  addPlus: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  // photo viewer
  photoWrap: { flex: 1, backgroundColor: colors.scrim, alignItems: "center", justifyContent: "center" },
  photoFull: { width: "92%", height: "80%" },
  photoClose: { color: colors.onPrimary, marginTop: spacing(2), fontSize: 15 },
  // modals
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrimSoft },
  splitWrap: {
    flex: 1,
    backgroundColor: colors.scrimSoft,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing(3),
  },
  splitCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(3),
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
  },
  splitTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: spacing(2) },
  splitBtns: { flexDirection: "row", gap: spacing(2), marginBottom: spacing(1) },
  splitChoice: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  splitChoiceText: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(2.5),
    maxHeight: "88%",
  },
  fieldLabel: { color: colors.textDim, fontSize: 14, marginTop: spacing(1.5), marginBottom: spacing(0.5) },
  personPreview: { alignItems: "center", marginBottom: spacing(1.5) },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: colors.transparent },
  swatchOn: { borderColor: colors.text },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginTop: spacing(1) },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestName: { color: colors.text, fontSize: 14 },
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
