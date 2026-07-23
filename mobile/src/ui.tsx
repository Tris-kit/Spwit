// Small shared UI building blocks used across screens.
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AVATAR_EMOJIS, colors, personColors, radius, spacing } from "./theme";
import { pickAvatarPhoto } from "./photo";
import { formatPhone } from "./util";
import { Person } from "./types";

export type IconName = React.ComponentProps<typeof Feather>["name"];

// Single line-icon primitive used everywhere in place of emoji chrome.
export function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Feather name={name} size={size} color={color} />;
}

// Spwit's mascot glyph.
export function CatLogo({
  size = 72,
  color = colors.primary,
}: {
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name="cat" size={size} color={color} />;
}

// Avatar emoji chooser: "Aa" (none) + a few defaults, a show-more toggle for the
// full set, and an "any emoji" field that opens the system emoji keyboard.
const EMOJI_DEFAULT_COUNT = 11;

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (emoji: string) => void;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const list = expanded ? AVATAR_EMOJIS : AVATAR_EMOJIS.slice(0, EMOJI_DEFAULT_COUNT);

  return (
    <View style={emojiStyles.grid}>
      <Pressable
        onPress={() => onChange("")}
        style={[emojiStyles.btn, value === "" && emojiStyles.btnOn]}
      >
        <Text style={emojiStyles.none}>Aa</Text>
      </Pressable>
      {list.map((em) => (
        <Pressable
          key={em}
          onPress={() => onChange(em)}
          style={[emojiStyles.btn, value === em && emojiStyles.btnOn]}
        >
          <Text style={{ fontSize: 22 }}>{em}</Text>
        </Pressable>
      ))}
      <Pressable onPress={() => setExpanded((x) => !x)} style={emojiStyles.btn}>
        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

// Tappable avatar (opens the photo picker) next to the name field, on one row.
export function AvatarNameRow({
  name,
  onName,
  color,
  emoji,
  photo,
  onPhoto,
  autoFocus,
}: {
  name: string;
  onName: (t: string) => void;
  color: string;
  emoji?: string;
  photo?: string;
  onPhoto: (uri: string) => void;
  autoFocus?: boolean;
}) {
  const choose = async () => {
    const uri = await pickAvatarPhoto();
    if (uri) onPhoto(uri);
  };
  return (
    <View style={aeStyles.row}>
      <Pressable onPress={choose} style={aeStyles.avatarWrap}>
        <Avatar name={name || "?"} color={color} emoji={emoji} photo={photo} size={60} />
        <View style={aeStyles.badge}>
          <Icon name="camera" size={12} color={colors.onPrimary} />
        </View>
      </Pressable>
      <Field
        value={name}
        onChangeText={onName}
        placeholder="Name"
        autoCapitalize="words"
        autoFocus={autoFocus}
        style={{ flex: 1 }}
      />
    </View>
  );
}

// Color swatches + emoji picker when there's no photo; a "Remove photo" button
// when there is (color/emoji don't show behind a photo).
export function AvatarStyleControls({
  color,
  onColor,
  emoji,
  onEmoji,
  photo,
  onRemovePhoto,
}: {
  color: string;
  onColor: (c: string) => void;
  emoji: string;
  onEmoji: (e: string) => void;
  photo?: string;
  onRemovePhoto: () => void;
}) {
  if (photo) {
    return (
      <Button
        title="Remove photo"
        variant="secondary"
        onPress={onRemovePhoto}
        style={{ marginTop: spacing(1.5) }}
      />
    );
  }
  return (
    <View>
      <Text style={aeStyles.label}>Avatar color</Text>
      <View style={aeStyles.swatchRow}>
        {personColors.map((c) => (
          <Pressable
            key={c}
            onPress={() => onColor(c)}
            style={[aeStyles.swatch, { backgroundColor: c }, color === c && aeStyles.swatchOn]}
          />
        ))}
      </View>
      <Text style={aeStyles.label}>Emoji</Text>
      <EmojiPicker value={emoji} onChange={onEmoji} />
    </View>
  );
}

const aeStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing(1.5), marginBottom: spacing(1) },
  avatarWrap: { position: "relative" },
  badge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  label: { color: colors.textDim, fontSize: 14, marginTop: spacing(1.5), marginBottom: spacing(0.5) },
  swatchRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3, borderColor: colors.transparent },
  swatchOn: { borderColor: colors.text },
});

const emojiStyles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1) },
  btn: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.transparent,
  },
  btnOn: { borderColor: colors.primary },
  none: { color: colors.textDim, fontSize: 15, fontWeight: "700" },
});

export type SwipeRowHandle = { close: () => void };

// A row that reveals a Delete button when swiped to the left. Built on
// PanResponder so it needs no extra native dependency. Exposes an imperative
// `close()` and fires `onOpen` when swiped open, so callers can coordinate it
// with other row state (e.g. an expand/collapse toggle).
export const SwipeRow = React.forwardRef<
  SwipeRowHandle,
  {
    children: React.ReactNode;
    onDelete: () => void;
    onOpen?: () => void;
    style?: ViewStyle;
  }
>(function SwipeRow({ children, onDelete, onOpen, style }, ref) {
  const OPEN = 88;
  const translateX = useRef(new Animated.Value(0)).current;
  const openRef = useRef(false);
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;

  const snap = (open: boolean) => {
    openRef.current = open;
    Animated.timing(translateX, {
      toValue: open ? -OPEN : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };

  React.useImperativeHandle(ref, () => ({ close: () => snap(false) }));

  const pan = useRef(
    PanResponder.create({
      // Only claim decisively-horizontal swipes.
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      // Don't hand the gesture back to the parent ScrollView mid-swipe — that's
      // what left rows stuck half-open.
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        const base = openRef.current ? -OPEN : 0;
        let next = base + g.dx;
        if (next > 0) next = 0;
        if (next < -OPEN - 24) next = -OPEN - 24;
        translateX.setValue(next);
      },
      onPanResponderRelease: (_e, g) => {
        const base = openRef.current ? -OPEN : 0;
        const pos = base + g.dx;
        // Commit only on a decisive swipe (past ~60%) or a fast flick; else snap
        // shut. It always lands fully open or fully closed — never in between.
        const willOpen = pos < -OPEN * 0.6 || g.vx < -0.5;
        snap(willOpen);
        if (willOpen) onOpenRef.current?.();
      },
      onPanResponderTerminate: () => snap(openRef.current),
    }),
  ).current;

  // Fade the delete affordance in as the row is pulled left (0 when closed, so
  // it never peeks behind the card's rounded corners at rest).
  const behindOpacity = translateX.interpolate({
    inputRange: [-88, -12, 0],
    outputRange: [1, 0, 0],
    extrapolate: "clamp",
  });

  return (
    <View style={[swipeStyles.wrap, style]}>
      <Animated.View style={[swipeStyles.behind, { opacity: behindOpacity }]}>
        <Pressable
          style={swipeStyles.btn}
          onPress={() => {
            snap(false);
            onDelete();
          }}
        >
          <Text style={swipeStyles.btnText}>Delete</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
});

const swipeStyles = StyleSheet.create({
  wrap: { position: "relative", marginBottom: spacing(1) },
  behind: {
    // Full-width so the red always fills everything to the right of the row —
    // you only ever see its rounded right edge, never the far/left edge, no
    // matter how far the row is pulled.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.danger,
    borderRadius: radius.md,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  btn: { width: 88, height: "100%", alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.onPrimary, fontWeight: "800", fontSize: 15 },
});

export function Button({
  title,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}) {
  const bg =
    variant === "primary"
      ? disabled
        ? colors.primaryDim
        : colors.primary
      : variant === "secondary"
        ? colors.surfaceAlt
        : colors.transparent;
  const fg = variant === "primary" ? colors.onPrimary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        variant === "ghost" && { paddingHorizontal: 0 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

// Text input in a bordered box. While focused it shows a checkmark button on the
// right that dismisses the keyboard — handy for numeric/phone fields that have no
// return key. Optionally renders a fixed, non-editable prefix (e.g. "@"/"$").
function BaseField({
  prefix,
  containerStyle,
  ...props
}: TextInputProps & { prefix?: string; containerStyle?: StyleProp<ViewStyle> }) {
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const [pressed, setPressed] = useState(false); // flash filled on tap
  const opacity = useRef(new Animated.Value(0)).current;

  // Fade the checkmark in on focus, out on blur.
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: focused ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      if (!focused) setPressed(false); // reset the flash once hidden
    });
  }, [focused, opacity]);

  const dismiss = () => {
    setPressed(true); // flash filled as it fades away
    ref.current?.blur();
    Keyboard.dismiss();
  };

  return (
    <View style={[styles.fieldBox, containerStyle, focused && styles.fieldBoxFocused]}>
      {prefix ? <Text style={styles.prefixText}>{prefix}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textDim}
        {...props}
        style={[styles.fieldInput, props.style]}
        onFocus={(e) => {
          setFocused(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          props.onBlur?.(e);
        }}
      />
      <Animated.View
        pointerEvents={focused ? "auto" : "none"}
        style={[styles.fieldCheckWrap, { opacity }]}
      >
        <Pressable
          onPress={dismiss}
          hitSlop={8}
          style={[styles.fieldCheck, pressed && styles.fieldCheckFilled]}
        >
          <Feather name="check" size={15} color={pressed ? colors.onPrimary : colors.primary} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Wrap a screen so a drag from the left edge past halfway slides it aside and
// triggers `onBack` (iOS-style back gesture). Only claims gestures that START at
// the left edge, so it never steals taps (e.g. the back arrow) or scrolls.
export function SwipeBackView({
  onBack,
  children,
  style,
}: {
  onBack?: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  const tx = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const backRef = useRef(onBack);
  backRef.current = onBack;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => {
        if (!backRef.current) return false;
        const startX = g.moveX - g.dx; // where the finger began
        return startX <= 30 && g.dx > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5;
      },
      onPanResponderMove: (_e, g) => tx.setValue(Math.max(0, g.dx)),
      onPanResponderRelease: (_e, g) => {
        const w = width || 400;
        if (g.dx > w * 0.5 || g.vx > 0.6) {
          // Finish sliding the old screen off, then swap the screen while hidden
          // (so it can't flash back) and fade the new one in.
          Animated.timing(tx, { toValue: w, duration: 130, useNativeDriver: true }).start(() => {
            opacity.setValue(0);
            backRef.current?.();
            tx.setValue(0);
            Animated.timing(opacity, { toValue: 1, duration: 140, useNativeDriver: true }).start();
          });
        } else {
          Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(tx, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[{ flex: 1, opacity, transform: [{ translateX: tx }] }, style]}
      {...pan.panHandlers}
    >
      {children}
    </Animated.View>
  );
}

export function Field({ style, ...props }: TextInputProps) {
  // Field callers pass `style` for layout (flex/margin) — route it to the box.
  return <BaseField {...props} containerStyle={style as StyleProp<ViewStyle>} />;
}

// A field with a fixed, non-editable prefix shown inside the box (e.g. "@" for a
// Venmo handle). The prefix is decorative — never part of the typed value.
export function PrefixField({
  prefix,
  containerStyle,
  ...props
}: TextInputProps & { prefix: string; containerStyle?: StyleProp<ViewStyle> }) {
  return <BaseField {...props} prefix={prefix} containerStyle={containerStyle} />;
}

// One reusable prompt modal — replaces the ugly native Alert.prompt everywhere.
// Renders one or more labelled fields (with the focus checkmark) + Cancel/Submit.
export type PromptField = {
  key: string;
  label?: string;
  placeholder?: string;
  initial?: string;
  prefix?: string; // e.g. "$" or "@"
  keyboardType?: TextInputProps["keyboardType"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  format?: (text: string) => string; // transform each keystroke (e.g. phone)
};

export function InputModal({
  visible,
  title,
  message,
  fields,
  submitLabel = "Save",
  onCancel,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  message?: string;
  fields: PromptField[];
  submitLabel?: string;
  onCancel: () => void;
  onSubmit: (values: Record<string, string>) => void;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  // Seed field values each time the modal opens.
  useEffect(() => {
    if (!visible) return;
    const init: Record<string, string> = {};
    for (const f of fields) init[f.key] = f.initial ?? "";
    setVals(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const set = (f: PromptField, v: string) =>
    setVals((prev) => ({ ...prev, [f.key]: f.format ? f.format(v) : v }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={promptStyles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={promptStyles.sheet}>
            <View style={promptStyles.grabber} />
            <Text style={promptStyles.title}>{title}</Text>
            {message ? <Text style={promptStyles.message}>{message}</Text> : null}
            {fields.map((f, i) => (
            <View key={f.key} style={{ marginTop: spacing(1.5) }}>
              {f.label ? <Text style={promptStyles.label}>{f.label}</Text> : null}
              {f.prefix ? (
                <PrefixField
                  prefix={f.prefix}
                  value={vals[f.key] ?? ""}
                  onChangeText={(t) => set(f, t)}
                  placeholder={f.placeholder}
                  keyboardType={f.keyboardType}
                  autoCapitalize={f.autoCapitalize}
                  autoFocus={i === 0}
                />
              ) : (
                <Field
                  value={vals[f.key] ?? ""}
                  onChangeText={(t) => set(f, t)}
                  placeholder={f.placeholder}
                  keyboardType={f.keyboardType}
                  autoCapitalize={f.autoCapitalize}
                  autoFocus={i === 0}
                />
              )}
            </View>
          ))}
            <View style={promptStyles.btns}>
              <Button title="Cancel" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
              <Button title={submitLabel} onPress={() => onSubmit(vals)} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const promptStyles = StyleSheet.create({
  // Bottom sheet: the keyboard pushes the whole sheet up as one unit (no jerky
  // re-centering, no field detaching from the card).
  root: { flex: 1, backgroundColor: colors.scrimSoft, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(3),
    paddingTop: spacing(1.5),
    paddingBottom: spacing(4),
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing(2),
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  message: { color: colors.textDim, fontSize: 14, marginTop: spacing(0.5) },
  label: { color: colors.textDim, fontSize: 13, marginBottom: spacing(0.5) },
  btns: { flexDirection: "row", gap: spacing(1.5), marginTop: spacing(3) },
});

export type PersonDraft = {
  name: string;
  phone?: string;
  emoji?: string;
  color: string;
  photo?: string;
};

// The shared add/edit person tray — one component used by the Build (item
// selection) screen and the Breakdown, so editing a profile looks identical
// everywhere. Manages its own form state, seeded from `initial` when opened.
export function PersonTray({
  visible,
  initial,
  defaultColor,
  savedProfiles,
  excludeNames,
  onQuickAdd,
  showImport,
  onImport,
  canDelete,
  onDelete,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial: Person | null; // null = adding a new person
  defaultColor?: string;
  savedProfiles?: Person[];
  excludeNames?: string[];
  onQuickAdd?: (p: Person) => void;
  showImport?: boolean;
  onImport?: () => void;
  canDelete?: boolean;
  onDelete?: () => void;
  onSave: (data: PersonDraft) => void;
  onClose: () => void;
}) {
  const isEdit = !!initial;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState(defaultColor ?? personColors[0]);
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;
    setName(initial?.name ?? "");
    setPhone(formatPhone(initial?.phone ?? ""));
    setEmoji(initial?.emoji ?? "");
    setColor(initial?.color || defaultColor || personColors[0]);
    setPhoto(initial?.photo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Custom animation: backdrop fades in, sheet slides up over it (and reverse on
  // close). Stays mounted through the exit animation.
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const backdrop = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(height)).current;
  useEffect(() => {
    if (visible) {
      setMounted(true);
      slide.setValue(height);
      backdrop.setValue(0);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(slide, { toValue: 0, useNativeDriver: true, bounciness: 2, speed: 14 }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(slide, { toValue: height, duration: 200, useNativeDriver: true }),
      ]).start(() => setMounted(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const q = name.trim().toLowerCase();
  const exclude = new Set((excludeNames ?? []).map((n) => n.trim().toLowerCase()));
  const suggestions =
    !isEdit && savedProfiles
      ? savedProfiles
          .filter((sp) => !exclude.has(sp.name.trim().toLowerCase()))
          .filter((sp) => (q ? sp.name.toLowerCase().includes(q) : true))
          .slice(0, 6)
      : [];

  const save = () => {
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      phone: phone.trim() || undefined,
      emoji: emoji || undefined,
      color,
      photo,
    });
  };

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={personTrayStyles.wrap}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimSoft, opacity: backdrop }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[personTrayStyles.sheet, { transform: [{ translateY: slide }] }]}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentInsetAdjustmentBehavior="never"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingBottom: spacing(2) }}
          >
            <AvatarNameRow
              name={name}
              onName={setName}
              color={color}
              emoji={emoji}
              photo={photo}
              onPhoto={setPhoto}
              autoFocus={!isEdit}
            />

            {!isEdit && showImport && (
              <Button
                title="Import from Contacts"
                onPress={() => onImport?.()}
                variant="secondary"
                style={{ marginBottom: spacing(1) }}
              />
            )}

            {suggestions.length > 0 && (
              <View style={personTrayStyles.suggestions}>
                {suggestions.map((sp) => (
                  <Pressable
                    key={sp.id}
                    onPress={() => onQuickAdd?.(sp)}
                    style={personTrayStyles.suggestChip}
                  >
                    <Avatar name={sp.name} color={sp.color} emoji={sp.emoji} photo={sp.photo} size={24} />
                    <Text style={personTrayStyles.suggestName}>{sp.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <Text style={personTrayStyles.label}>Phone (optional)</Text>
            <Field
              value={phone}
              onChangeText={(t) => setPhone(formatPhone(t))}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />

            <AvatarStyleControls
              color={color}
              onColor={setColor}
              emoji={emoji}
              onEmoji={setEmoji}
              photo={photo}
              onRemovePhoto={() => setPhoto(undefined)}
            />

            <Button
              title={isEdit ? "Save" : "Add"}
              onPress={save}
              disabled={!name.trim()}
              style={{ marginTop: spacing(2) }}
            />
            {isEdit && canDelete && onDelete && (
              <Button title="Remove from bill" onPress={() => onDelete()} variant="ghost" />
            )}
            <Button title="Cancel" onPress={onClose} variant="ghost" />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const personTrayStyles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(2.5),
    maxHeight: "88%",
  },
  label: {
    color: colors.textDim,
    fontSize: 14,
    marginTop: spacing(1.5),
    marginBottom: spacing(0.5),
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: spacing(1), marginBottom: spacing(1) },
  suggestChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing(0.75),
    paddingVertical: spacing(0.5),
    paddingHorizontal: spacing(1),
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  suggestName: { color: colors.text, fontSize: 14, fontWeight: "600" },
});

export function Avatar({
  name,
  color,
  emoji,
  photo,
  size = 36,
  selected,
}: {
  name: string;
  color: string;
  emoji?: string;
  photo?: string;
  size?: number;
  selected?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: photo ? colors.surfaceAlt : color, // color shows behind emoji + initials
        alignItems: "center",
        justifyContent: "center",
        borderWidth: selected ? 3 : 0,
        borderColor: colors.primary,
        overflow: "hidden",
      }}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: size, height: size }} />
      ) : emoji ? (
        <Text style={{ fontSize: size * 0.55 }}>{emoji}</Text>
      ) : (
        <Icon name="user" size={size * 0.5} color={colors.text} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing(2),
  },
  btnText: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing(2),
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldBoxFocused: { borderColor: colors.primary },
  fieldInput: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 16,
    paddingVertical: 0,
    paddingRight: 34, // leave room for the focus checkmark on the right
  },
  fieldCheckWrap: {
    position: "absolute",
    right: spacing(1),
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  fieldCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.transparent,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldCheckFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  prefixText: { color: colors.text, fontSize: 16 },
});
