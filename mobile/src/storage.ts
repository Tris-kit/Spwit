// Local persistence for the "me" profile, saved people (for quick re-add), and
// the history of completed receipts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Person, SavedReceipt } from "./types";
import { personColors } from "./theme";

const ME_KEY = "me_profile_v1";
const PROFILES_KEY = "saved_profiles_v1";
const HISTORY_KEY = "history_v1";

// Default owner profile — editable later.
export const defaultMe: Person = {
  id: "me",
  name: "Tristan",
  emoji: "🧑",
  color: personColors[0],
  isMe: true,
};

export async function loadMe(): Promise<Person> {
  try {
    const raw = await AsyncStorage.getItem(ME_KEY);
    return raw ? { ...defaultMe, ...JSON.parse(raw), isMe: true } : defaultMe;
  } catch {
    return defaultMe;
  }
}

export async function saveMe(me: Person): Promise<void> {
  try {
    await AsyncStorage.setItem(ME_KEY, JSON.stringify(me));
  } catch {
    // best-effort
  }
}

export async function loadProfiles(): Promise<Person[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveProfiles(profiles: Person[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  } catch {
    // best-effort
  }
}

// --- Saved receipts (history) --------------------------------------------

export async function loadHistory(): Promise<SavedReceipt[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(history: SavedReceipt[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    // best-effort
  }
}
