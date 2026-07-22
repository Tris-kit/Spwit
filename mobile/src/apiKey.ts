// Stores AI provider API keys in the device keychain (dev convenience) and the
// currently-selected provider. NOTE: a key living in the app is fine for
// personal/dev use only — never ship a build with a real key baked in.
// Production would call a backend proxy.
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type AiProvider = "claude" | "gemini";

// Keep the Claude key under its original name so existing saved keys still work.
const KEYS: Record<AiProvider, string> = {
  claude: "anthropic_api_key",
  gemini: "gemini_api_key",
};
const PROVIDER_PREF = "ai_provider_v1";
const OCR_MODE_PREF = "ocr_mode_v1";

// Where receipt OCR runs: "backend" (Tabby's server key, no on-device key) or
// "device" (your own key stored in the keychain). Defaults to backend.
export type OcrMode = "backend" | "device";

export async function getOcrMode(): Promise<OcrMode> {
  try {
    const v = await AsyncStorage.getItem(OCR_MODE_PREF);
    return v === "device" ? "device" : "backend";
  } catch {
    return "backend";
  }
}

export async function setOcrMode(mode: OcrMode): Promise<void> {
  try {
    await AsyncStorage.setItem(OCR_MODE_PREF, mode);
  } catch {
    // best-effort
  }
}

export const getApiKey = (provider: AiProvider) => SecureStore.getItemAsync(KEYS[provider]);
export const setApiKey = (provider: AiProvider, value: string) =>
  SecureStore.setItemAsync(KEYS[provider], value);
export const clearApiKey = (provider: AiProvider) => SecureStore.deleteItemAsync(KEYS[provider]);

export async function getProvider(): Promise<AiProvider> {
  try {
    const v = await AsyncStorage.getItem(PROVIDER_PREF);
    return v === "gemini" ? "gemini" : "claude";
  } catch {
    return "claude";
  }
}

export async function setProvider(provider: AiProvider): Promise<void> {
  try {
    await AsyncStorage.setItem(PROVIDER_PREF, provider);
  } catch {
    // best-effort
  }
}
