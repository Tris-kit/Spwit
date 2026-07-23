// Spwit — receipt tab splitter. Flow: start → build → tax/tip → totals.
// Start also branches out to Profile, Contacts, and History.
import React, { useEffect, useState } from "react";
import {
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Assignments, Charges, Item, Person, SavedReceipt } from "./src/types";
import { makeId } from "./src/util";
import {
  defaultMe,
  hasProfile,
  loadHistory,
  loadMe,
  loadProfiles,
  saveHistory,
  saveMe,
  saveProfiles,
} from "./src/storage";
import { OnboardingScreen } from "./src/screens/OnboardingScreen";
import { StartScreen } from "./src/screens/StartScreen";
import { BuildScreen } from "./src/screens/BuildScreen";
import { ChargesScreen } from "./src/screens/ChargesScreen";
import { ResultsScreen } from "./src/screens/ResultsScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { ContactsScreen } from "./src/screens/ContactsScreen";
import { HistoryScreen } from "./src/screens/HistoryScreen";
import { colors, personColors } from "./src/theme";

type Step =
  | "start"
  | "build"
  | "charges"
  | "results"
  | "profile"
  | "contacts"
  | "history";

const emptyCharges: Charges = {
  taxAmount: 0,
  tipMode: "percent",
  tipPercent: 18,
  tipAmount: 0,
};

export default function App() {
  const [step, setStep] = useState<Step>("start");
  const [items, setItems] = useState<Item[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [charges, setCharges] = useState<Charges>(emptyCharges);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [billId, setBillId] = useState<string>("");
  const [billName, setBillName] = useState<string>("");
  // Whether the current bill came from history (affects where "Done" returns to)
  // and whether we're in an edit round-trip (affects the Build back button).
  const [billFromHistory, setBillFromHistory] = useState(false);
  const [editingBill, setEditingBill] = useState(false);

  const [me, setMe] = useState<Person>(defaultMe);
  const [savedProfiles, setSavedProfiles] = useState<Person[]>([]);
  const [history, setHistory] = useState<SavedReceipt[]>([]);
  // When jumping from Contacts to a specific bill, History expands + scrolls to it.
  const [historyFocusId, setHistoryFocusId] = useState<string | null>(null);
  // null = still checking; false = show first-launch onboarding; true = ready.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    loadMe().then(setMe);
    loadProfiles().then(setSavedProfiles);
    loadHistory().then(setHistory);
    hasProfile().then(setOnboarded);
  }, []);

  // Finish first-launch setup: save the profile, then enter the app.
  const completeOnboarding = (info: { name: string; venmo?: string; phone?: string }) => {
    saveMeProfile({
      ...defaultMe,
      name: info.name,
      venmo: info.venmo,
      phone: info.phone,
      isMe: true,
    });
    setOnboarded(true);
  };

  const startBill = (
    parsedItems: { name: string; price: number }[],
    taxAmount: number | null,
    uri: string | null,
  ) => {
    setItems(parsedItems.map((p) => ({ id: makeId("item"), name: p.name, price: p.price })));
    setAssignments({});
    setCharges({ ...emptyCharges, taxAmount: taxAmount ?? 0 });
    setReceiptImage(uri);
    setPeople([{ ...me, contactId: "me" }]); // you're the one holding the phone
    setBillId(makeId("bill"));
    setBillName("");
    setBillFromHistory(false);
    setEditingBill(false);
    setStep("build");
  };

  // Ensure a saved contact exists for this participant and return its stable id
  // (reusing an existing contact matched by name). The returned id is stored on
  // the bill participant as `contactId` to link them without losing the snapshot.
  const ensureContact = (p: Person): string => {
    const key = p.name.trim().toLowerCase();
    const existing = savedProfiles.find((sp) => sp.name.trim().toLowerCase() === key);
    if (existing) return existing.id;
    const id = makeId("contact");
    const contact: Person = {
      ...p,
      id,
      contactId: undefined,
      isMe: false,
      color: p.color || personColors[savedProfiles.length % personColors.length],
    };
    const next = [...savedProfiles, contact];
    setSavedProfiles(next);
    saveProfiles(next);
    return id;
  };

  const addContact = (p: Person) => {
    const contact: Person = {
      ...p,
      id: makeId("profile"),
      color: p.color || personColors[savedProfiles.length % personColors.length],
    };
    const next = [...savedProfiles, contact];
    setSavedProfiles(next);
    saveProfiles(next);
  };

  const updateSavedProfile = (p: Person) => {
    const next = savedProfiles.map((sp) => (sp.id === p.id ? p : sp));
    setSavedProfiles(next);
    saveProfiles(next);
  };

  const deleteSavedProfile = (id: string) => {
    const next = savedProfiles.filter((sp) => sp.id !== id);
    setSavedProfiles(next);
    saveProfiles(next);
  };

  // Patch a person on the current bill (e.g. adding a phone on the results
  // screen). Also mirror the change into any matching saved contact.
  const updatePerson = (id: string, patch: Partial<Person>) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    const person = people.find((p) => p.id === id);
    if (person) {
      const match = savedProfiles.find(
        (sp) =>
          (person.contactId && sp.id === person.contactId) ||
          sp.name.toLowerCase() === person.name.toLowerCase(),
      );
      if (match) updateSavedProfile({ ...match, ...patch });
    }
  };

  const saveMeProfile = (p: Person) => {
    const next = { ...p, isMe: true };
    setMe(next);
    saveMe(next);
    // Keep the current bill's "me" chip in sync if a split is in progress.
    setPeople((prev) => prev.map((x) => (x.isMe ? { ...x, ...next } : x)));
  };

  // Upsert the current bill into history, keyed by billId (preserving the
  // original date on updates). Called on reaching results and on leaving it so
  // late edits (e.g. added phone numbers) are saved.
  const saveCurrentToHistory = () => {
    const existing = history.find((h) => h.id === billId);
    const entry: SavedReceipt = {
      id: billId || makeId("bill"),
      dateISO: existing?.dateISO ?? new Date().toISOString(),
      bill: { name: billName.trim() || undefined, items, people, assignments, charges },
      receiptImage,
      unpaid: existing?.unpaid,
      shareId: existing?.shareId,
      shareEditToken: existing?.shareEditToken,
    };
    const rest = history.filter((h) => h.id !== entry.id);
    const next = [entry, ...rest];
    setHistory(next);
    saveHistory(next);
  };

  // Persist the short-link id/token onto the current bill's history record.
  const saveShareInfo = (recordId: string, shareId: string, shareEditToken: string) => {
    const next = history.map((h) =>
      h.id === recordId ? { ...h, shareId, shareEditToken } : h,
    );
    setHistory(next);
    saveHistory(next);
  };

  // Persist server-synced paid-status onto a bill's history record.
  const saveBillUnpaid = (recordId: string, unpaid: string[]) => {
    const next = history.map((h) => (h.id === recordId ? { ...h, unpaid } : h));
    setHistory(next);
    saveHistory(next);
  };

  const updateReceipt = (r: SavedReceipt) => {
    const next = history.map((h) => (h.id === r.id ? r : h));
    setHistory(next);
    saveHistory(next);
  };

  const goToResults = () => {
    saveCurrentToHistory();
    setStep("results");
  };

  // Reopen a saved bill on the final screen to tweak it or re-send the text blast.
  const openReceipt = (r: SavedReceipt) => {
    setItems(r.bill.items);
    setPeople(r.bill.people);
    setAssignments(r.bill.assignments);
    setCharges(r.bill.charges);
    setReceiptImage(r.receiptImage);
    setBillName(r.bill.name ?? "");
    setBillId(r.id);
    setBillFromHistory(true);
    setEditingBill(true); // editing an existing bill → Build returns to results
    setStep("results");
  };

  // From the breakdown, jump back into the edit wizard (items/people first).
  const editBill = () => {
    setEditingBill(true);
    setStep("build");
  };

  const leaveResults = (to: Step) => {
    saveCurrentToHistory();
    setStep(to);
  };

  const deleteReceipt = (id: string) => {
    const next = history.filter((h) => h.id !== id);
    setHistory(next);
    saveHistory(next);
  };

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  // Wide viewports (desktop web) get a floating app panel instead of a
  // full-height phone-width column. Mobile web (< 768) is unchanged.
  const isDesktop = isWeb && width >= 768;

  const shell = (children: React.ReactNode) => (
    <View style={[styles.outer, isWeb && styles.outerWeb, isDesktop && styles.outerDesktop]}>
      <SafeAreaView
        style={[styles.root, isWeb && styles.rootWeb, isDesktop && styles.rootDesktop]}
      >
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        {children}
      </SafeAreaView>
    </View>
  );

  if (onboarded === null) return shell(null); // still loading persisted state
  if (!onboarded) return shell(<OnboardingScreen onDone={completeOnboarding} />);

  return shell(
    <>
      {step === "start" && (
        <StartScreen
          me={me}
          onScanned={(items, tax, uri) => startBill(items, tax, uri)}
          onManual={() => startBill([], null, null)}
          onOpenProfile={() => setStep("profile")}
          onOpenContacts={() => setStep("contacts")}
          onOpenHistory={() => setStep("history")}
        />
      )}

      {step === "build" && (
        <BuildScreen
          items={items}
          setItems={setItems}
          people={people}
          setPeople={setPeople}
          assignments={assignments}
          setAssignments={setAssignments}
          savedProfiles={savedProfiles}
          onEnsureContact={ensureContact}
          receiptImage={receiptImage}
          billName={billName}
          setBillName={setBillName}
          onBack={() => setStep(editingBill ? "results" : "start")}
          onNext={() => setStep("charges")}
        />
      )}

      {step === "charges" && (
        <ChargesScreen
          items={items}
          charges={charges}
          setCharges={setCharges}
          receiptImage={receiptImage}
          billName={billName}
          onBack={() => setStep("build")}
          onNext={goToResults}
        />
      )}

      {step === "results" && (
        <ResultsScreen
          bill={{ name: billName.trim() || undefined, items, people, assignments, charges }}
          me={me}
          receiptImage={receiptImage}
          fromHistory={billFromHistory}
          shareId={history.find((h) => h.id === billId)?.shareId}
          shareEditToken={history.find((h) => h.id === billId)?.shareEditToken}
          unpaid={history.find((h) => h.id === billId)?.unpaid}
          onShared={(shareId, editToken) => saveShareInfo(billId, shareId, editToken)}
          onUpdatePerson={updatePerson}
          onUnpaidSynced={(unpaid) => saveBillUnpaid(billId, unpaid)}
          onBack={() => (billFromHistory ? leaveResults("history") : setStep("charges"))}
          onEdit={editBill}
          onRestart={() => leaveResults(billFromHistory ? "history" : "start")}
        />
      )}

      {step === "profile" && (
        <ProfileScreen me={me} onSave={saveMeProfile} onBack={() => setStep("start")} />
      )}

      {step === "contacts" && (
        <ContactsScreen
          contacts={savedProfiles}
          history={history}
          onAdd={addContact}
          onUpdate={updateSavedProfile}
          onDelete={deleteSavedProfile}
          onOpenBill={(billId) => {
            setHistoryFocusId(billId);
            setStep("history");
          }}
          onBack={() => setStep("start")}
        />
      )}

      {step === "history" && (
        <HistoryScreen
          history={history}
          me={me}
          contacts={savedProfiles}
          onOpen={openReceipt}
          onUpdate={updateReceipt}
          onDelete={deleteReceipt}
          onBack={() => setStep("start")}
          focusId={historyFocusId}
          onFocusHandled={() => setHistoryFocusId(null)}
        />
      )}
    </>,
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bg },
  // On web, sit the phone-width app column on a neutral backdrop, centered.
  outerWeb: { backgroundColor: colors.webBackdrop, alignItems: "center" },
  root: { flex: 1, backgroundColor: colors.bg },
  rootWeb: {
    width: "100%",
    maxWidth: 460,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  // Desktop web: center a floating, rounded app panel (not a full-height phone).
  outerDesktop: {
    justifyContent: "center",
    paddingVertical: 32,
  },
  rootDesktop: {
    maxWidth: 600,
    maxHeight: 900,
    borderWidth: 1,
    borderRadius: 24,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
  },
});
