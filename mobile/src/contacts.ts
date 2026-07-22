// Shared "pick one contact from the iPhone address book" helper. Used by the
// Contacts screen and the Build screen's add-person sheet. Fails gracefully when
// the native module isn't in the running build (needs a fresh Xcode build).
import { Alert } from "react-native";

export type ImportedContact = {
  name: string;
  phone?: string;
  photo?: string; // a file:// uri (decoded from the contact's inline image)
};

// expo-contacts on iOS returns the photo as a **bare filesystem path** (no
// scheme), sometimes as a `data:` URI, or a `file://` uri. Normalize whatever we
// get into a durable file:// in the app's documents dir so <Image> can render it
// and it survives restarts. Best-effort — returns undefined on any failure.
async function persistContactPhoto(
  raw: string | undefined,
  id: string,
): Promise<string | undefined> {
  if (!raw) return undefined;
  try {
    const FileSystem = require("expo-file-system/legacy");
    const doc: string = FileSystem.documentDirectory;

    if (raw.startsWith("data:")) {
      const comma = raw.indexOf(",");
      const meta = raw.substring(5, raw.indexOf(";")); // e.g. "image/png"
      const ext = (meta.split("/")[1] || "png").replace("jpeg", "jpg");
      const dest = `${doc}contact_${id}.${ext}`;
      await FileSystem.writeAsStringAsync(dest, raw.substring(comma + 1), { encoding: "base64" });
      return dest;
    }

    // Bare path ("/var/…/x.png") or a "file://…" uri → copy to documents.
    const fileUri = raw.startsWith("file://") ? raw : `file://${raw}`;
    if (fileUri.startsWith(doc)) return fileUri; // already durable
    const ext =
      ((raw.split("?")[0].split(".").pop() || "png").slice(0, 4).replace(/[^a-z0-9]/gi, "") || "png");
    const dest = `${doc}contact_${id}.${ext}`;
    await FileSystem.copyAsync({ from: fileUri, to: dest });
    return dest;
  } catch {
    // Fall back to a usable file:// uri if we at least have a path.
    if (raw.startsWith("file://")) return raw;
    if (raw.startsWith("/")) return `file://${raw}`;
    return undefined;
  }
}

export async function pickContact(): Promise<ImportedContact | null> {
  try {
    const Contacts = require("expo-contacts");
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow Contacts access to import people.");
      return null;
    }
    const picked = await Contacts.presentContactPickerAsync();
    if (!picked) return null;

    // Re-fetch with the image fields explicitly requested (the picker omits them).
    let contact = picked;
    if (picked.id) {
      try {
        contact = await Contacts.getContactByIdAsync(picked.id, [
          Contacts.Fields.Name,
          Contacts.Fields.FirstName,
          Contacts.Fields.LastName,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
          Contacts.Fields.RawImage,
        ]);
      } catch {
        contact = picked;
      }
    }

    const name =
      contact.name ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      "Contact";
    const phone = contact.phoneNumbers?.[0]?.number as string | undefined;
    const rawPhoto = (contact.image?.uri ?? contact.rawImage?.uri) as string | undefined;
    const photo = await persistContactPhoto(rawPhoto, contact.id ?? name.replace(/\W/g, ""));

    return { name, phone: phone || undefined, photo };
  } catch (e: any) {
    // The JS package can be present while the native module isn't linked into
    // the currently-installed build.
    const msg = String(e?.message ?? e);
    if (/native module|ExpoContacts|not available|cannot find/i.test(msg)) {
      Alert.alert(
        "Rebuild needed",
        "Importing from your iPhone contacts needs a fresh build of the app. Rebuild and reinstall from Xcode (▶ Run), then try again.",
      );
    } else {
      Alert.alert("Couldn't import", msg);
    }
    return null;
  }
}
