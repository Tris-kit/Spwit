// Shared receipt-capture + OCR helpers used by the Start and Build screens.
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ParsedReceipt, recognizeReceiptGemini } from "./ocr";
import { AiProvider, getApiKey, setApiKey } from "./apiKey";
import { persistToDocuments } from "./photo";

/** iOS prompt to paste + securely store the selected provider's key. */
export function promptForKey(provider: AiProvider): Promise<string | null> {
  const title = provider === "gemini" ? "Google AI (Gemini) API key" : "Anthropic (Claude) API key";
  const hint =
    provider === "gemini"
      ? "Paste your Gemini key (AIza…). Stored securely on this device."
      : "Paste your key (sk-ant-…). Stored securely on this device.";
  return new Promise((resolve) => {
    Alert.prompt(
      title,
      hint,
      [
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
        {
          text: "Save",
          onPress: async (val?: string) => {
            const v = (val ?? "").trim();
            if (!v) return resolve(null);
            await setApiKey(provider, v);
            resolve(v);
          },
        },
      ],
      "secure-text",
    );
  });
}

/** Open camera or library; returns the picked image URI, or null if cancelled. */
export async function captureReceipt(fromCamera: boolean): Promise<string | null> {
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

/** Run receipt OCR (Gemini). Handles the API-key prompt. */
export async function scanReceipt(uri: string): Promise<ParsedReceipt> {
  let key = await getApiKey("gemini");
  if (!key) key = await promptForKey("gemini");
  if (!key) throw new Error("No API key entered.");
  return recognizeReceiptGemini(uri, key);
}
