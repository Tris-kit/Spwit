// Shared receipt-capture + OCR helpers used by the Start and Build screens.
// OCR always runs through the Spwit backend (server's key) — there is no
// on-device API key. If the backend isn't configured, the user adds items by hand.
import { Alert, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ParsedReceipt } from "./receiptParse";
import { isBackendEnabled, scanReceiptViaBackend } from "./backend";
import { persistToDocuments } from "./photo";

export type { ParsedReceipt } from "./receiptParse";

/** Open camera or library; returns the picked image URI, or null if cancelled. */
export async function captureReceipt(fromCamera: boolean): Promise<string | null> {
  // On web there's no native camera / photo library — a single file picker
  // (which offers "Take Photo" on mobile browsers) covers both paths.
  if (Platform.OS === "web") {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  }

  const perm = fromCamera
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    Alert.alert(
      "Permission needed",
      `Allow access to ${fromCamera ? "the camera" : "your photos"} to scan a receipt.`,
    );
    return null;
  }
  const result = fromCamera
    ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
    : await ImagePicker.launchImageLibraryAsync({ quality: 0.6 });
  if (result.canceled || !result.assets?.[0]) return null;
  // Persist so the receipt still shows when reopened from history later.
  return persistToDocuments(result.assets[0].uri, "receipt");
}

/** Run receipt OCR via the Spwit backend (server-side key, no on-device key). */
export async function scanReceipt(uri: string): Promise<ParsedReceipt> {
  if (!isBackendEnabled()) {
    throw new Error("Receipt scanning isn't available in this build.");
  }
  return scanReceiptViaBackend(uri);
}
