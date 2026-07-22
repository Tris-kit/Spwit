// Open the Messages composer as a single group thread with everyone who has a
// phone number, prefilled with the split summary. Uses expo-sms (which drives
// the native MFMessageComposeViewController with multiple recipients) and falls
// back to the sms: URL scheme if the native module isn't in the build yet.
import { Alert, Linking } from "react-native";

export async function sendGroupText(recipients: string[], body: string): Promise<void> {
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
