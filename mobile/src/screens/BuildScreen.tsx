// The workhorse screen. Assignment model: pick the active person at the bottom,
// then tap items to assign them to that person. Tap the gear on a row to reveal
// edit actions (rename / re-price / split); swipe a row left to delete it.
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Assignments, Item, Person } from "../types";
import { splitEqually, toCents } from "../split";
import { pickContact } from "../contacts";
import { Avatar, AvatarNameRow, AvatarStyleControls, Button, Card, Field, Icon, SwipeRow } from "../ui";
import { makeId } from "../util";
import { colors, personColors, radius, spacing } from "../theme";

// The per-item edit actions that crossfade in when the ⋯ is tapped and out when
// dismissed. Gear and icons are overlaid; opacity animates between them.
function RowActions({
  active,
  onOpen,
  onRename,
  onPrice,
  onSplit,
}: {
  active: boolean;
  onOpen: () => void;
  onRename: () => void;
  onPrice: () => void;
  onSplit: () => void;
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
        <Pressable onPress={onRename} hitSlop={8} style={raStyles.btn}>
          <Icon name="edit-2" size={16} color={colors.primary} />
        </Pressable>
        <Pressable onPress={onPrice} hitSlop={8} style={raStyles.btn}>
          <Icon name="dollar-sign" size={16} color={colors.primary} />
        </Pressable>
        <Pressable onPress={onSplit} hitSlop={8} style={raStyles.btn}>
          <Icon name="divide" size={16} color={colors.primary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const raStyles = StyleSheet.create({
  wrap: { width: 108, height: 34, justifyContent: "center", alignItems: "flex-end" },
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
  const [viewingPhoto, setViewingPhoto] = useState(false);
  // Track people-row scroll geometry to hint when more people are off-screen.
  const peopleRef = useRef<ScrollView>(null);
  const [peopleScroll, setPeopleScroll] = useState({ x: 0, w: 0, c: 0 });
  const showPeopleHint =
    peopleScroll.c > peopleScroll.w + 8 &&
    peopleScroll.x < peopleScroll.c - peopleScroll.w - 8;

  // Add / edit-person sheet
  const [addingPerson, setAddingPerson] = useState(false);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pPhone, setPPhone] = useState("");
  const [pEmoji, setPEmoji] = useState(""); // "" = no emoji (initials)
  const [pColor, setPColor] = useState(personColors[0]);
  const [pPhoto, setPPhoto] = useState<string | undefined>(undefined);

  const active = activeId ?? people[0]?.id ?? null;
  const activePerson = people.find((p) => p.id === active);
  const editingIsMe = !!editingPersonId && !!people.find((p) => p.id === editingPersonId)?.isMe;

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

  // --- item editing (native prompts stay above the keyboard) ------------
  const promptRename = (item: Item) => {
    Alert.prompt(
      "Rename item",
      undefined,
      [
        { text: "Cancel", style: "cancel", onPress: () => setEditingRowId(null) },
        {
          text: "Save",
          onPress: (text?: string) => {
            const name = (text ?? "").trim();
            if (name) setItems(items.map((i) => (i.id === item.id ? { ...i, name } : i)));
            setEditingRowId(null);
          },
        },
      ],
      "plain-text",
      item.name,
    );
  };

  const promptPrice = (item: Item) => {
    Alert.prompt(
      "Edit price",
      "Enter the dollar amount",
      [
        { text: "Cancel", style: "cancel", onPress: () => setEditingRowId(null) },
        {
          text: "Save",
          onPress: (text?: string) => {
            const p = parseFloat((text ?? "").replace(/[^0-9.]/g, ""));
            if (!isNaN(p)) setItems(items.map((i) => (i.id === item.id ? { ...i, price: p } : i)));
            setEditingRowId(null);
          },
        },
      ],
      "plain-text",
      String(item.price),
      "decimal-pad",
    );
  };

  const promptSplit = (item: Item) => {
    Alert.prompt(
      "Split item",
      `Divide "${item.name}" into how many separate items?`,
      [
        { text: "Cancel", style: "cancel", onPress: () => setEditingRowId(null) },
        {
          text: "Split",
          onPress: (text?: string) => {
            const n = parseInt((text ?? "").replace(/[^0-9]/g, ""), 10);
            if (n >= 2) {
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
            setEditingRowId(null);
          },
        },
      ],
      "plain-text",
      "2",
      "number-pad",
    );
  };

  const deleteItem = (id: string) => {
    setItems(items.filter((i) => i.id !== id));
    const a = { ...assignments };
    delete a[id];
    setAssignments(a);
    if (editingRowId === id) setEditingRowId(null);
  };

  const promptName = () => {
    Alert.prompt(
      "Name this bill",
      "e.g. Sushi night",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Save", onPress: (t?: string) => setBillName((t ?? "").trim()) },
      ],
      "plain-text",
      billName,
    );
  };

  const addItem = () => {
    setEditingRowId(null);
    Alert.prompt(
      "New item",
      "Item name",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Next",
          onPress: (name?: string) => {
            const nm = (name ?? "").trim() || "Item";
            Alert.prompt(
              "Price",
              `Price for "${nm}"`,
              [
                { text: "Skip", onPress: () => setItems([...items, { id: makeId("item"), name: nm, price: 0 }]) },
                {
                  text: "Add",
                  onPress: (priceText?: string) => {
                    const p = parseFloat((priceText ?? "").replace(/[^0-9.]/g, "")) || 0;
                    setItems([...items, { id: makeId("item"), name: nm, price: p }]);
                  },
                },
              ],
              "plain-text",
              "",
              "decimal-pad",
            );
          },
        },
      ],
      "plain-text",
      "",
    );
  };

  // --- people -----------------------------------------------------------
  const resetPersonForm = () => {
    setPName("");
    setPPhone("");
    setPEmoji("");
    setPColor(personColors[people.length % personColors.length]);
    setPPhoto(undefined);
    setEditingPersonId(null);
  };
  const openAddPerson = () => {
    setEditingRowId(null);
    resetPersonForm();
    setAddingPerson(true);
  };
  const openEditPerson = (p: Person) => {
    setEditingRowId(null);
    setEditingPersonId(p.id);
    setPName(p.name);
    setPPhone(p.phone ?? "");
    setPEmoji(p.emoji ?? "");
    setPColor(p.color || personColors[0]);
    setPPhoto(p.photo);
    setAddingPerson(true);
  };
  const savePerson = () => {
    const name = pName.trim();
    if (!name) return;
    if (editingPersonId) {
      // Edit an existing bill participant in place.
      setPeople(
        people.map((p) =>
          p.id === editingPersonId
            ? {
                ...p,
                name,
                phone: pPhone.trim() || undefined,
                emoji: pEmoji || undefined,
                color: pColor,
                photo: pPhoto,
              }
            : p,
        ),
      );
    } else {
      const base: Person = {
        id: makeId("person"),
        name,
        phone: pPhone.trim() || undefined,
        emoji: pEmoji || undefined,
        color: pColor,
        photo: pPhoto,
      };
      const person = { ...base, contactId: onEnsureContact(base) };
      setPeople([...people, person]);
      setActiveId(person.id);
    }
    resetPersonForm();
    setAddingPerson(false);
  };
  const quickAdd = (profile: Person) => {
    // Link this bill participant to the existing saved contact.
    const person = { ...profile, id: makeId("person"), contactId: profile.id };
    setPeople([...people, person]);
    setActiveId(person.id);
    resetPersonForm();
    setAddingPerson(false);
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
    resetPersonForm();
    setAddingPerson(false);
  };
  const removePerson = (p: Person) => {
    setPeople(people.filter((x) => x.id !== p.id));
    const next: Assignments = {};
    for (const [itemId, ids] of Object.entries(assignments)) {
      next[itemId] = ids.filter((id) => id !== p.id);
    }
    setAssignments(next);
    if (active === p.id) setActiveId(null);
  };

  const total = items.reduce((s, i) => s + i.price, 0);
  const unassigned = items.filter((i) => (assignments[i.id] ?? []).length === 0).length;

  // Warn before advancing if some items still belong to nobody.
  const handleNext = () => {
    if (unassigned > 0) {
      Alert.alert(
        "Unassigned items",
        `${unassigned} item${unassigned > 1 ? "s aren't" : " isn't"} assigned to anyone. ` +
          `They won't be counted in the split. Continue anyway?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: onNext },
        ],
      );
      return;
    }
    onNext();
  };

  // typeahead over past profiles not already in the bill
  const q = pName.trim().toLowerCase();
  const suggestions = savedProfiles
    .filter((sp) => !people.some((p) => p.name.toLowerCase() === sp.name.toLowerCase()))
    .filter((sp) => (q ? sp.name.toLowerCase().includes(q) : true))
    .slice(0, 6);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        <View style={styles.headerRow}>
          <Pressable onPress={promptName} style={styles.titleBtn} hitSlop={6}>
            <Text
              style={[styles.h1, !billName && styles.h1Placeholder]}
              numberOfLines={1}
            >
              {billName || "Name this bill"}
            </Text>
            <Icon name="edit-2" size={15} color={colors.textDim} />
          </Pressable>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing(1.5) }}>
            {receiptImage && (
              <Pressable onPress={() => setViewingPhoto(true)} hitSlop={8} style={styles.viewPhotoBtn}>
                <Icon name="file-text" size={14} color={colors.primary} />
                <Text style={styles.viewPhoto}>Receipt</Text>
              </Pressable>
            )}
            <Text style={styles.total}>${total.toFixed(2)}</Text>
          </View>
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
                onPress={() => toggleAssign(item.id)}
                style={[styles.itemRow, mine && styles.itemRowActive]}
              >
                <View style={{ flex: 1 }}>
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
                </View>
                <Text style={styles.itemPrice}>${item.price.toFixed(2)}</Text>
                <RowActions
                  active={editing}
                  onOpen={() => setEditingRowId(item.id)}
                  onRename={() => promptRename(item)}
                  onPrice={() => promptPrice(item)}
                  onSplit={() => promptSplit(item)}
                />
              </Pressable>
            </SwipeRow>
          );
        })}

        <Pressable onPress={addItem} style={styles.addItem}>
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
                    setActiveId(p.id);
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

      {/* ---- Add person ---- */}
      <Modal visible={addingPerson} transparent animationType="slide" onRequestClose={() => setAddingPerson(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <Pressable
            style={styles.modalWrap}
            onPress={() => {
              resetPersonForm();
              setAddingPerson(false);
            }}
          >
            <Pressable style={styles.sheet} onPress={() => {}}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <AvatarNameRow
                  name={pName}
                  onName={setPName}
                  color={pColor}
                  emoji={pEmoji}
                  photo={pPhoto}
                  onPhoto={setPPhoto}
                  autoFocus={!editingPersonId}
                />

                {!editingPersonId && (
                  <Button
                    title="Import from Contacts"
                    onPress={importPerson}
                    variant="secondary"
                    style={{ marginBottom: spacing(1) }}
                  />
                )}

                {!editingPersonId && suggestions.length > 0 && (
                  <View style={styles.suggestions}>
                    {suggestions.map((sp) => (
                      <Pressable key={sp.id} onPress={() => quickAdd(sp)} style={styles.suggestChip}>
                        <Avatar name={sp.name} color={sp.color} emoji={sp.emoji} photo={sp.photo} size={24} />
                        <Text style={styles.suggestName}>{sp.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                <Text style={styles.fieldLabel}>Phone (optional)</Text>
                <Field
                  value={pPhone}
                  onChangeText={setPPhone}
                  placeholder="For sending them their bill"
                  keyboardType="phone-pad"
                />

                <AvatarStyleControls
                  color={pColor}
                  onColor={setPColor}
                  emoji={pEmoji}
                  onEmoji={setPEmoji}
                  photo={pPhoto}
                  onRemovePhoto={() => setPPhoto(undefined)}
                />

                <Button
                  title={editingPersonId ? "Save" : "Add"}
                  onPress={savePerson}
                  disabled={!pName.trim()}
                  style={{ marginTop: spacing(2) }}
                />
                {editingPersonId && !editingIsMe && (
                  <Button
                    title="Remove from bill"
                    onPress={() => {
                      const p = people.find((x) => x.id === editingPersonId);
                      if (p) removePerson(p);
                      resetPersonForm();
                      setAddingPerson(false);
                    }}
                    variant="ghost"
                  />
                )}
                <Button
                  title="Cancel"
                  onPress={() => {
                    resetPersonForm();
                    setAddingPerson(false);
                  }}
                  variant="ghost"
                />
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing(1) },
  titleBtn: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800", flexShrink: 1 },
  h1Placeholder: { color: colors.textDim },
  viewPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewPhoto: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  total: { color: colors.textDim, fontSize: 18, fontWeight: "700" },
  sub: { color: colors.textDim, fontSize: 14, marginTop: 2, marginBottom: spacing(1.5) },
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
  photoWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photoFull: { width: "92%", height: "80%" },
  photoClose: { color: "#fff", marginTop: spacing(2), fontSize: 15 },
  // modals
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
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
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: "transparent" },
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
    borderColor: "transparent",
  },
  emojiBtnOn: { borderColor: colors.primary },
  noneText: { color: colors.textDim, fontSize: 15, fontWeight: "700" },
});
