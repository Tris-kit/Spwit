// First-launch setup: ask the user's name (required) plus Venmo and phone
// (optional). Shown once, before the rest of the app, when no profile is saved.
import React, { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Field } from "../ui";
import { colors, spacing } from "../theme";

export function OnboardingScreen({
  onDone,
}: {
  onDone: (info: { name: string; venmo?: string; phone?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [venmo, setVenmo] = useState("");
  const [phone, setPhone] = useState("");

  const canContinue = name.trim().length > 0;
  const submit = () => {
    if (!canContinue) return;
    onDone({
      name: name.trim(),
      venmo: venmo.trim().replace(/^@/, "") || undefined,
      phone: phone.trim() || undefined,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.root}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <View style={styles.mascot}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 60, height: 60 }}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title}>Welcome to Spwit</Text>
        <Text style={styles.subtitle}>
          Let's set up your profile — only your name is required.
        </Text>
      </View>

      <Text style={styles.label}>Your name</Text>
      <Field value={name} onChangeText={setName} placeholder="e.g. Alex" autoFocus />

      <Text style={styles.label}>
        Venmo <Text style={styles.optional}>(optional)</Text>
      </Text>
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
      <Text style={styles.hint}>So people can pay you back with one tap.</Text>

      <Text style={styles.label}>
        Phone <Text style={styles.optional}>(optional)</Text>
      </Text>
      <Field
        value={phone}
        onChangeText={setPhone}
        placeholder="Your phone number"
        keyboardType="phone-pad"
      />

      <View style={{ height: spacing(3) }} />
      <Button title="Get started" onPress={submit} disabled={!canContinue} />
      <Text style={styles.foot}>You can change these anytime in your profile.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { padding: spacing(3), paddingTop: spacing(6), flexGrow: 1 },
  hero: { alignItems: "center", marginBottom: spacing(4) },
  mascot: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: spacing(1.5),
  },
  subtitle: {
    color: colors.textDim,
    fontSize: 15,
    marginTop: spacing(1),
    textAlign: "center",
    paddingHorizontal: spacing(2),
  },
  label: {
    color: colors.textDim,
    fontSize: 14,
    marginTop: spacing(2),
    marginBottom: spacing(0.5),
  },
  optional: { color: colors.textFaint, fontWeight: "400" },
  at: { color: colors.textDim, fontSize: 18, marginRight: spacing(1) },
  hint: { color: colors.textDim, fontSize: 12, marginTop: spacing(0.5) },
  foot: {
    color: colors.textFaint,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing(2),
  },
});
