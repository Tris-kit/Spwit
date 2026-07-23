// Cross-platform single-field text prompt. iOS has Alert.prompt (which floats
// above the keyboard); it doesn't exist on web or Android, so there we fall back
// to the browser's window.prompt. The signature mirrors Alert.prompt so the call
// sites read identically on every platform.
import { Alert, Platform } from "react-native";

type PromptButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: (text?: string) => void;
};

export function promptText(
  title: string,
  message?: string,
  buttons: PromptButton[] = [],
  type: "plain-text" | "secure-text" | "login-password" = "plain-text",
  defaultValue?: string,
  keyboardType?: string,
): void {
  if (Platform.OS === "ios") {
    Alert.prompt(
      title,
      message,
      buttons as any,
      type as any,
      defaultValue,
      keyboardType as any,
    );
    return;
  }

  // web / android: one text field via the browser prompt. Convention (matching
  // every iOS call site): the FIRST button is the cancel/secondary action and
  // the LAST button is the confirm action that receives the entered text.
  const cancelBtn = buttons[0];
  const confirmBtn = buttons[buttons.length - 1];
  const promptFn =
    typeof globalThis !== "undefined" ? (globalThis as any).prompt : undefined;

  if (typeof promptFn !== "function") return; // non-browser env — best-effort no-op

  const label = message ? `${title}\n${message}` : title;
  const result = promptFn(label, defaultValue ?? "");
  if (result === null) {
    cancelBtn?.onPress?.(undefined);
  } else {
    confirmBtn?.onPress?.(result);
  }
}
