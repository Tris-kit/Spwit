// Local persistence for the "me" profile, saved people (for quick re-add), and
// the history of completed receipts.
//
// Image references (avatar photos, receipt images) are stored as bare filenames
// via toStoredImage/fromStoredImage — never absolute container paths, which iOS
// invalidates across reinstalls and OS updates. See src/photo.ts.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Person, SavedReceipt } from "./types";
import { personColors } from "./theme";
import { fromStoredImage, toStoredImage } from "./photo";

const ME_KEY = "me_profile_v1";
const PROFILES_KEY = "saved_profiles_v1";
const HISTORY_KEY = "history_v1";

// Default owner profile — name is filled in during first-launch onboarding.
export const defaultMe: Person = {
  id: "me",
  name: "",
  color: personColors[0],
  isMe: true,
};

// True once the user has saved their profile (i.e. finished onboarding).
export async function hasProfile(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ME_KEY)) !== null;
  } catch {
    return false;
  }
}

export async function loadMe(): Promise<Person> {
  try {
    const raw = await AsyncStorage.getItem(ME_KEY);
    if (!raw) return defaultMe;
    const parsed = JSON.parse(raw) as Person;
    return { ...defaultMe, ...parsed, photo: fromStoredImage(parsed.photo), isMe: true };
  } catch {
    return defaultMe;
  }
}

export async function saveMe(me: Person): Promise<void> {
  try {
    await AsyncStorage.setItem(ME_KEY, JSON.stringify({ ...me, photo: toStoredImage(me.photo) }));
  } catch {
    // best-effort
  }
}

export async function loadProfiles(): Promise<Person[]> {
  try {
    const raw = await AsyncStorage.getItem(PROFILES_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as Person[]).map((p) => ({ ...p, photo: fromStoredImage(p.photo) }));
  } catch {
    return [];
  }
}

export async function saveProfiles(profiles: Person[]): Promise<void> {
  try {
    const durable = profiles.map((p) => ({ ...p, photo: toStoredImage(p.photo) }));
    await AsyncStorage.setItem(PROFILES_KEY, JSON.stringify(durable));
  } catch {
    // best-effort
  }
}

// --- Saved receipts (history) --------------------------------------------

export async function loadHistory(): Promise<SavedReceipt[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as SavedReceipt[]).map((r) => ({
      ...r,
      receiptImage: fromStoredImage(r.receiptImage) ?? null,
      bill: {
        ...r.bill,
        people: r.bill.people.map((p) => ({ ...p, photo: fromStoredImage(p.photo) })),
      },
    }));
  } catch {
    return [];
  }
}

export async function saveHistory(history: SavedReceipt[]): Promise<void> {
  try {
    const durable = history.map((r) => ({
      ...r,
      receiptImage: toStoredImage(r.receiptImage) ?? null,
      bill: {
        ...r.bill,
        people: r.bill.people.map((p) => ({ ...p, photo: toStoredImage(p.photo) })),
      },
    }));
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(durable));
  } catch {
    // best-effort
  }
}
