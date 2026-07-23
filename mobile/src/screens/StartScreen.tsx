// Home: profile + quick links up top, one big "Split a bill" button → camera →
// OCR → hand items to the app.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { captureReceipt, scanReceipt } from "../scan";
import { Person } from "../types";
import { Avatar, Icon } from "../ui";
import { colors, radius, spacing } from "../theme";

export function StartScreen({
  me,
  onScanned,
  onManual,
  onOpenProfile,
  onOpenContacts,
  onOpenHistory,
}: {
  me: Person;
  onScanned: (
    items: { name: string; price: number }[],
    taxAmount: number | null,
    uri: string,
  ) => void;
  onManual: () => void;
  onOpenProfile: () => void;
  onOpenContacts: () => void;
  onOpenHistory: () => void;
}) {
  const [busy, setBusy] = useState(false);

  // The developer's tip jar — fixed, not the current profile's Venmo.
  const openTip = () => {
    Linking.openURL("https://venmo.com/u/tristan-schwichow");
  };

  const run = async (fromCamera: boolean) => {
    const uri = await captureReceipt(fromCamera);
    if (!uri) return;
    setBusy(true);
    try {
      const parsed = await scanReceipt(uri);
      const items = parsed.items.filter((i) => i.name && i.price > 0);
      onScanned(items, parsed.taxAmount, uri);
    } catch (e: any) {
      Alert.alert(
        "Couldn't read the receipt",
        `${e?.message ?? e}\n\nYou can still add items by hand.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Add manually", onPress: () => onScanned([], null, uri) },
        ],
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <Pressable style={styles.profileBtn} onPress={onOpenProfile} hitSlop={8}>
          <Avatar name={me.name} color={me.color} emoji={me.emoji} photo={me.photo} size={36} />
          <Text style={styles.profileName} numberOfLines={1}>{me.name}</Text>
        </Pressable>
        <View style={styles.topLinks}>
          <Pressable onPress={onOpenContacts} hitSlop={8} style={styles.iconBtn}>
            <Icon name="users" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={onOpenHistory} hitSlop={8} style={styles.iconBtn}>
            <Icon name="clock" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.mascot}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 68, height: 68 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Spwit</Text>
        <Text style={styles.subtitle}>
          Snap a receipt, tap who had what, done.
        </Text>
      </View>

      {busy ? (
        <View style={styles.bigBtn}>
          <ActivityIndicator color={colors.onPrimary} />
          <Text style={styles.bigBtnText}>Reading receipt…</Text>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.bigBtn, pressed && { opacity: 0.9 }]}
          onPress={() => run(true)}
        >
          <Icon name="camera" size={34} color={colors.onPrimary} />
          <Text style={styles.bigBtnText}>Split a bill</Text>
        </Pressable>
      )}

      <View style={styles.secondaryRow}>
        <Pressable onPress={() => run(false)} disabled={busy} hitSlop={8}>
          <Text style={styles.link}>Choose a photo</Text>
        </Pressable>
        <Text style={styles.dot}>·</Text>
        <Pressable onPress={onManual} disabled={busy} hitSlop={8}>
          <Text style={styles.link}>Enter manually</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      <Pressable onPress={openTip} hitSlop={6} style={styles.tipRow}>
        <Text style={styles.tip}>Like Spwit? Buy me a coffee to keep it free.</Text>
        <Icon name="external-link" size={11} color={colors.textFaint} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: spacing(3), paddingTop: spacing(2) },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing(4),
  },
  profileBtn: { flexDirection: "row", alignItems: "center", gap: spacing(1), flexShrink: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  topLinks: { flexDirection: "row", alignItems: "center", gap: spacing(1) },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: { alignItems: "center", marginBottom: spacing(5) },
  mascot: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: 0.5,
    marginTop: spacing(1.5),
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 16,
    marginTop: spacing(1),
    textAlign: "center",
  },
  bigBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing(3),
    alignItems: "center",
    justifyContent: "center",
    gap: spacing(1),
    minHeight: 130,
  },
  bigBtnText: { color: colors.onPrimary, fontSize: 22, fontWeight: "800" },
  secondaryRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: spacing(1.5),
    marginTop: spacing(2.5),
  },
  link: { color: colors.primary, fontSize: 15, fontWeight: "600" },
  dot: { color: colors.textDim },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: spacing(2),
  },
  tip: { color: colors.textFaint, fontSize: 11 },
});
