// Shared photo helpers.
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";

// Copy a picked/temp image into the app's document directory so it survives app
// restarts (ImagePicker/camera temp files get purged). Best-effort: returns the
// original uri if the file-system module isn't available (needs a rebuild).
export async function persistToDocuments(uri: string, prefix = "img"): Promise<string> {
  if (!uri) return uri;
  try {
    const FileSystem = require("expo-file-system/legacy");
    if (uri.startsWith(FileSystem.documentDirectory)) return uri; // already durable
    const ext = ((uri.split("?")[0].split(".").pop() || "jpg").slice(0, 4)).replace(/[^a-z0-9]/gi, "") || "jpg";
    const dest = `${FileSystem.documentDirectory}${prefix}_${Date.now()}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

// --- Durable image references ------------------------------------------------
// iOS changes the app's container path across reinstalls and OS updates, so an
// absolute Documents URI saved today can be invalid tomorrow (the classic
// "photos disappeared after an update" bug). We therefore persist only the
// basename and rebuild the absolute path against the CURRENT document directory
// on load. (A dev reinstall also wipes the container's files entirely — that
// loss is unavoidable; this fixes the production case where files survive.)

function documentDir(): string {
  try {
    return require("expo-file-system/legacy").documentDirectory ?? "";
  } catch {
    return "";
  }
}

function basename(uri: string): string {
  return uri.split("?")[0].split("/").pop() ?? uri;
}

// App-owned = a file we copied into Documents (absolute path containing
// "/Documents/") or an already-stored bare basename. External uris (http://,
// ph://, temp picker files) are left untouched.
function isAppImage(uri: string): boolean {
  return uri.includes("/Documents/") || (!uri.includes("/") && !uri.includes("://"));
}

/** Convert an in-memory image uri to its on-disk, container-independent form. */
export function toStoredImage(uri?: string | null): string | undefined {
  if (!uri) return undefined;
  return isAppImage(uri) ? basename(uri) : uri;
}

/** Resolve a stored image reference to a valid uri for the current container. */
export function fromStoredImage(stored?: string | null): string | undefined {
  if (!stored) return undefined;
  if (isAppImage(stored)) {
    const dir = documentDir();
    return dir ? `${dir}${basename(stored)}` : stored;
  }
  return stored;
}

export async function pickAvatarPhoto(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert("Permission needed", "Allow photo access to choose a picture.");
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
  });
  if (!result.canceled && result.assets?.[0]) {
    return persistToDocuments(result.assets[0].uri, "avatar");
  }
  return null;
}
