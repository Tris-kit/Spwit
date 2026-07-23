// Small shared UI building blocks used across screens.
import React, { useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { AVATAR_EMOJIS, colors, personColors, radius, spacing } from "./theme";
import { pickAvatarPhoto } from "./photo";

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
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 120,
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

export function Field(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={colors.textDim}
      {...props}
      style={[styles.field, props.style]}
    />
  );
}

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
  field: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing(2),
    height: 48,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
