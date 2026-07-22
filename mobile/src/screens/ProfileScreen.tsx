// Your profile: name, phone, Venmo, Zelle, and avatar (photo / emoji / color).
// Used to prefill "me" on every bill and to build the payment lines in texts.
import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Person } from "../types";
import { AvatarNameRow, AvatarStyleControls, Field } from "../ui";
import { colors, personColors, spacing } from "../theme";

export function ProfileScreen({
  me,
  onSave,
  onBack,
}: {
  me: Person;
  onSave: (p: Person) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone ?? "");
  const [venmo, setVenmo] = useState(me.venmo ?? "");
  const [zelle, setZelle] = useState(me.zelle ?? "");
  const [emoji, setEmoji] = useState(me.emoji ?? "");
  const [color, setColor] = useState(me.color || personColors[0]);
  const [photo, setPhoto] = useState(me.photo);

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
});
