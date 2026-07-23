// Open the Messages composer as a single group thread with everyone who has a
// phone number, prefilled with the split summary. Uses expo-sms (which drives
// the native MFMessageComposeViewController with multiple recipients) and falls
// back to the sms: URL scheme if the native module isn't in the build yet.
import { Alert, Linking, Platform } from "react-native";

export async function sendGroupText(recipients: string[], body: string): Promise<void> {
  // Web can't open the Messages app — share the summary text, or copy it.
  if (Platform.OS === "web") {
    await shareOnWeb(body);
    return;
  }

  const nums = recipients.map((n) => n.replace(/[^\d+]/g, "")).filter(Boolean);
  if (nums.length === 0) {
    Alert.alert("No phone numbers", "Add a phone number to at least one person first.");
    return;
  }

  try {
    const SMS = require("expo-sms");
    if (await SMS.isAvailableAsync()) {
      // Multiple recipients → one group thread, body prefilled.
      await SMS.sendSMSAsync(nums, body);
      return;
    }
  } catch {
    // Native module missing (needs a rebuild) — fall through to URL scheme.
  }

  const url = `sms:${nums.join(",")}&body=${encodeURIComponent(body)}`;
  Linking.openURL(url).catch(() =>
    Alert.alert("Couldn't open Messages", "This device can't send text messages."),
  );
}

// Web: use the native share sheet if available (mobile browsers), otherwise
// copy the summary to the clipboard so the user can paste it wherever.
async function shareOnWeb(body: string): Promise<void> {
  const nav: any = typeof navigator !== "undefined" ? navigator : undefined;
  try {
    if (nav?.share) {
      await nav.share({ text: body });
      return;
    }
  } catch {
    // User cancelled the share sheet, or it failed — fall through to copy.
  }
  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(body);
      Alert.alert("Copied", "The split summary was copied — paste it into any chat.");
      return;
    }
  } catch {
    // ignore
  }
  Alert.alert("Share the summary", body);
}
