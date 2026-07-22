// Its own step: tax (from the receipt) and tip (% presets or exact amount) at
// the top; the running total is the last thing on the screen.
import React, { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Charges, Item } from "../types";
import { Button, Card, Field, Icon } from "../ui";
import { colors, radius, spacing } from "../theme";

const TIP_PRESETS = [15, 18, 20, 25];

export function ChargesScreen({
  items,
  charges,
  setCharges,
  receiptImage,
  onBack,
  onNext,
}: {
  items: Item[];
  charges: Charges;
  setCharges: (c: Charges) => void;
  receiptImage: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [viewingPhoto, setViewingPhoto] = useState(false);
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const tip =
    charges.tipMode === "percent"
      ? (subtotal * charges.tipPercent) / 100
      : charges.tipAmount;
  const grand = subtotal + charges.taxAmount + tip;

  // The tip input always shows the current tip in dollars. When a percent preset
  // is active it mirrors the computed amount; when the user types, we switch to a
  // fixed amount and leave their text untouched (no reformatting mid-edit).
  const [tipText, setTipText] = useState(tip ? tip.toFixed(2) : "");
  useEffect(() => {
    if (charges.tipMode === "percent") {
      setTipText(tip ? tip.toFixed(2) : "");
    }
  }, [charges.tipMode, charges.tipPercent, subtotal, tip]);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}>
        <View style={styles.headerRow}>
          <Text style={styles.h1}>Tax & Tip</Text>
          {receiptImage && (
            <Pressable onPress={() => setViewingPhoto(true)} hitSlop={8} style={styles.viewPhotoBtn}>
              <Icon name="file-text" size={14} color={colors.primary} />
              <Text style={styles.viewPhoto}>Receipt</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.h2}>Tax</Text>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={styles.dollar}>$</Text>
            <Field
              placeholder="0.00"
              value={charges.taxAmount ? String(charges.taxAmount) : ""}
              onChangeText={(t) => setCharges({ ...charges, taxAmount: parseFloat(t) || 0 })}
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
          </View>
          <Text style={styles.hint}>Auto-filled from the receipt when detected.</Text>
        </Card>

        <Text style={styles.h2}>Tip</Text>
        <View style={styles.tipRow}>
          {TIP_PRESETS.map((pct) => {
            const active = charges.tipMode === "percent" && charges.tipPercent === pct;
            return (
              <Pressable
                key={pct}
                onPress={() => setCharges({ ...charges, tipMode: "percent", tipPercent: pct })}
                style={[styles.tipChip, active && styles.tipChipActive]}
              >
                <Text style={[styles.tipChipText, active && { color: "#fff" }]}>{pct}%</Text>
              </Pressable>
            );
          })}
        </View>
        <Card style={{ marginTop: spacing(1) }}>
          <Text style={styles.hint}>Tip amount (tap a percent above, or edit):</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing(1) }}>
            <Text style={styles.dollar}>$</Text>
            <Field
              placeholder="0.00"
              value={tipText}
              onChangeText={(t) => {
                setTipText(t);
                setCharges({ ...charges, tipMode: "amount", tipAmount: parseFloat(t) || 0 });
              }}
              keyboardType="decimal-pad"
              style={{ flex: 1 }}
            />
          </View>
        </Card>

        {/* Total — last thing on the screen. */}
        <Card style={{ marginTop: spacing(3), backgroundColor: colors.surfaceAlt }}>
          <Row label="Subtotal" value={subtotal} />
          <Row label="Tax" value={charges.taxAmount} />
          <Row label="Tip" value={tip} />
          <View style={styles.divider} />
          <Row label="Total" value={grand} bold />
        </Card>
      </ScrollView>

      <View style={styles.footer}>
        <View style={{ flexDirection: "row", gap: spacing(1) }}>
          <Button title="Back" onPress={onBack} variant="secondary" style={{ flex: 1 }} />
          <Button title="See totals" onPress={onNext} style={{ flex: 2 }} />
        </View>
      </View>

      <Modal visible={viewingPhoto} transparent animationType="fade" onRequestClose={() => setViewingPhoto(false)}>
        <Pressable style={styles.photoWrap} onPress={() => setViewingPhoto(false)}>
          {receiptImage && (
            <Image source={{ uri: receiptImage }} style={styles.photoFull} resizeMode="contain" />
          )}
          <Text style={styles.photoClose}>Tap to close</Text>
        </Pressable>
      </Modal>
    </View>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text style={[styles.rowValue, bold && styles.bold]}>${value.toFixed(2)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewPhotoBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewPhoto: { color: colors.primary, fontSize: 14, fontWeight: "600" },
  photoWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photoFull: { width: "92%", height: "80%" },
  photoClose: { color: "#fff", marginTop: spacing(2), fontSize: 15 },
  h1: { color: colors.text, fontSize: 28, fontWeight: "800" },
  h2: { color: colors.text, fontSize: 18, fontWeight: "700", marginTop: spacing(2.5), marginBottom: spacing(1) },
  hint: { color: colors.textDim, fontSize: 13 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing(0.75) },
  rowLabel: { color: colors.textDim, fontSize: 16 },
  rowValue: { color: colors.text, fontSize: 16 },
  bold: { color: colors.text, fontWeight: "800", fontSize: 20 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing(0.5) },
  dollar: { color: colors.textDim, fontSize: 18, marginRight: spacing(1) },
  tipRow: { flexDirection: "row", gap: spacing(1) },
  tipChip: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  tipChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tipChipText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  footer: { padding: spacing(2), borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
});
