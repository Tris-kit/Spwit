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
