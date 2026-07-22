// Your profile: name, phone, Venmo, Zelle, and avatar (photo / emoji / color).
// Used to prefill "me" on every bill and to build the payment lines in texts.
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Person } from "../types";
import { AvatarNameRow, AvatarStyleControls, Button, Field } from "../ui";
import { colors, personColors, radius, spacing } from "../theme";
import { getApiKey, getOcrMode, OcrMode, setOcrMode } from "../apiKey";
import { promptForKey } from "../scan";
import { BackendStatus } from "../backend";

export function ProfileScreen({
  me,
  onSave,
  onBack,
  backendStatus,
}: {
  me: Person;
  onSave: (p: Person) => void;
  onBack: () => void;
  backendStatus: BackendStatus;
}) {
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [venmo, setVenmo] = useState(me.venmo ?? "");
  const [zelle, setZelle] = useState(me.zelle ?? "");
  const [emoji, setEmoji] = useState(me.emoji ?? "");
  const [color, setColor] = useState(me.color || personColors[0]);
  const [photo, setPhoto] = useState(me.photo);

  // Receipt-scanning source: Tabby's backend vs the user's own on-device key.
  const [ocrMode, setOcrModeState] = useState<OcrMode>("backend");
  const [keySaved, setKeySaved] = useState(false);
  const backendDisabled = backendStatus === "disabled";

  useEffect(() => {
    getOcrMode().then(setOcrModeState);
    getApiKey("gemini").then((k) => setKeySaved(!!k));
  }, []);

  const chooseMode = (mode: OcrMode) => {
    if (mode === "backend" && backendDisabled) return;
    setOcrModeState(mode);
    setOcrMode(mode);
  };

  const editKey = async () => {
    const key = await promptForKey("gemini");
    if (key) setKeySaved(true);
  };

  const backendHint =
    backendStatus === "checking"
      ? "Checking backend…"
      : backendStatus === "online"
        ? "Scans run on Tabby's server — no API key needed."
        : backendStatus === "offline"
          ? "Backend unreachable — scans fall back to your own key."
          : "Not configured in this build.";

  const deviceHint = keySaved
    ? "Using your Gemini key stored on this device."
    : "You'll be asked for a Gemini key on your first scan.";

  // Auto-save whatever's entered, then leave (invoked from the back button).
  const saveAndBack = () => {
    onSave({
      ...me,
      name: name.trim() || "Me",
      phone: phone.trim() || undefined,
      venmo: venmo.trim().replace(/^@/, "") || undefined,
      zelle: zelle.trim() || undefined,
      emoji: emoji || undefined,
      color,
      photo,
      isMe: true,
    });
    onBack();
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.header}>
        <Pressable onPress={saveAndBack} hitSlop={8}>
          <Text style={styles.back}>‹ Save</Text>
        </Pressable>
        <Text style={styles.h1}>Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing(2), paddingBottom: spacing(4) }}
        keyboardShouldPersistTaps="handled"
      >
        <AvatarNameRow
          name={name}
          onName={setName}
          color={color}
          emoji={emoji}
          photo={photo}
          onPhoto={setPhoto}
        />

        <Text style={styles.label}>Phone</Text>
        <Field value={phone} onChangeText={setPhone} placeholder="Your phone number" keyboardType="phone-pad" />

        <Text style={styles.label}>Venmo handle</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={styles.at}>@</Text>
          <Field
            value={venmo}
            onChangeText={setVenmo}
            placeholder="your-venmo"
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1 }}
          />
        </View>
        <Text style={styles.hint}>Used to add a "Pay me on Venmo" link when you text people.</Text>

        <Text style={styles.label}>Zelle (phone or email)</Text>
        <Field
          value={zelle}
          onChangeText={setZelle}
          placeholder="phone number or email"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
        />
        <Text style={styles.hint}>
          Added to your text as "Pay me on Zelle: …" so people can pay you in their bank app.
        </Text>

        <AvatarStyleControls
          color={color}
          onColor={setColor}
          emoji={emoji}
          onEmoji={setEmoji}
          photo={photo}
          onRemovePhoto={() => setPhoto(undefined)}
        />

        <View style={styles.divider} />

        <Text style={styles.section}>Receipt scanning</Text>
        <View style={styles.segment}>
          <Pressable
            onPress={() => chooseMode("backend")}
            disabled={backendDisabled}
            style={[
              styles.segBtn,
              ocrMode === "backend" && styles.segBtnOn,
              backendDisabled && styles.segBtnDisabled,
            ]}
          >
            <Text style={[styles.segText, ocrMode === "backend" && styles.segTextOn]}>
              Tabby cloud
            </Text>
          </Pressable>
          <Pressable
            onPress={() => chooseMode("device")}
            style={[styles.segBtn, ocrMode === "device" && styles.segBtnOn]}
          >
            <Text style={[styles.segText, ocrMode === "device" && styles.segTextOn]}>
              My own key
            </Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{ocrMode === "backend" ? backendHint : deviceHint}</Text>

        {ocrMode === "device" && (
          <Button
            title={keySaved ? "Replace Gemini key" : "Set Gemini key"}
            variant="secondary"
            onPress={editKey}
            style={{ marginTop: spacing(1.5) }}
          />
        )}
      </ScrollView>
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
  headerSpacer: { width: 60 },
  h1: { color: colors.text, fontSize: 20, fontWeight: "800" },
  label: { color: colors.textDim, fontSize: 14, marginTop: spacing(2), marginBottom: spacing(0.5) },
  at: { color: colors.textDim, fontSize: 18, marginRight: spacing(1) },
  hint: { color: colors.textDim, fontSize: 12, marginTop: spacing(0.5) },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: spacing(3),
    marginBottom: spacing(1),
  },
  section: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: spacing(1) },
  segment: {
    flexDirection: "row",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 4,
    gap: 4,
  },
  segBtn: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  segBtnOn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  segBtnDisabled: { opacity: 0.4 },
  segText: { color: colors.textDim, fontSize: 15, fontWeight: "700" },
  segTextOn: { color: colors.text },
});
