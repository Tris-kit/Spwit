// Central style tokens so the whole app looks like one system.
// Spwit — warm light theme: off-white canvas, rich-orange accents, warm ink.

export const colors = {
  bg: "#FFF9F4", // warm off-white canvas
  surface: "#FFFFFF", // cards
  surfaceAlt: "#FFEDDF", // soft peach — selected / tinted rows
  border: "#F1E2D5", // warm hairline
  text: "#26190F", // warm near-black
  textDim: "#937B69", // muted warm gray-brown
  textFaint: "#C7B8AB", // faintest captions (e.g. the tip line)
  primary: "#EA580C", // rich orange — primary actions
  primaryDim: "#FDBA8C", // light orange — disabled / tints
  onPrimary: "#FFFFFF", // text/icons sitting on primary or other colored fills
  success: "#16A34A",
  warning: "#D97706", // amber
  warningTint: "#FEF3E2", // light amber fill for warning cards
  warningText: "#9A3412", // readable dark-orange text on warningTint
  danger: "#DC2626",
  scrim: "rgba(0, 0, 0, 0.92)", // heavy backdrop — full-screen photo viewer
  scrimSoft: "rgba(0, 0, 0, 0.5)", // lighter backdrop — bottom-sheet modals
  transparent: "transparent",
};

// Same color at a given opacity — lets alpha shades (e.g. gradient fades) derive
// from a theme color instead of hard-coding rgba(), so changing `primary` here
// updates them everywhere. Accepts #rgb / #rrggbb.
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Soft pastel avatar backgrounds (dark initials sit on top — see Avatar).
export const personColors = [
  "#FDBA8C", // peach
  "#FCD34D", // amber
  "#86EFAC", // green
  "#7DD3FC", // sky
  "#C4B5FD", // violet
  "#F9A8D4", // pink
  "#5EEAD4", // teal
  "#BEF264", // lime
];

// Quick-pick avatar emojis for people (optional — initials/photo are the default).
// The first handful show by default; the rest appear behind "show more", and any
// other emoji can be typed via the system keyboard.
export const AVATAR_EMOJIS = [
  "🐱", "🐶", "🦊", "🐼", "🦁", "🐸", "🐨", "🐯", "🐰", "🐻",
  "🐷", "🐮", "🐵", "🐔", "🐧", "🐢", "🦉", "🦄", "🐙", "🦕",
  "😎", "🤠", "🥳", "🤓", "🙂", "😄", "😇", "🤩", "😺", "🧐",
  "🧑", "👩", "👨", "🧔", "👱", "👵", "👴", "🦸", "🦹", "🧑‍🍳",
  "🍕", "🍔", "🌮", "🍜", "🍣", "🍟", "🥗", "🍩", "🍦", "🥑",
  "🍆", "🍑", "💧",
  "🍺", "🍷", "🍸", "🍹", "☕", "🧋", "🥤", "🍾", "🧉", "🍶",
  "⭐", "🔥", "⚡", "🌈", "💎", "🎸", "⚽", "🏀", "🎮", "🚀",
];

export const spacing = (n: number) => n * 8;

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 };
