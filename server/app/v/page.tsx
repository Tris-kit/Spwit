// DB-free share view: /v#<encoded-bill>. The entire bill is packed into the URL
// hash by the app; we decode it client-side (the hash never reaches the server,
// so the data isn't logged) and render the same breakdown as /s.
"use client";

import { useEffect, useState } from "react";
import { Bill } from "@/lib/types";
import { decodeBill } from "@/lib/billCodec";
import { BillView } from "@/components/BillView";

type State = { status: "loading" } | { status: "ok"; bill: Bill } | { status: "error" };

export default function ViewPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    // Re-decode on mount AND whenever the hash changes — opening a different
    // link in the same tab only changes the fragment, which doesn't remount.
    const load = () => {
      const encoded = window.location.hash.replace(/^#/, "");
      const bill = encoded ? decodeBill(encoded) : null;
      setState(bill ? { status: "ok", bill } : { status: "error" });
    };
    load();
    window.addEventListener("hashchange", load);
    return () => window.removeEventListener("hashchange", load);
  }, []);

  if (state.status === "ok") return <BillView bill={state.bill} />;

  return (
    <main style={msg.page}>
      <div style={msg.box}>
        <div style={msg.brand}>Tabby</div>
        <p style={msg.text}>
          {state.status === "loading"
            ? "Loading split…"
            : "This link looks invalid or incomplete. Ask for a fresh one."}
        </p>
      </div>
    </main>
  );
}

const msg: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  box: { textAlign: "center" },
  brand: {
    color: "var(--primary)",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 13,
    marginBottom: 8,
  },
  text: { color: "var(--text-dim)", fontSize: 16, maxWidth: 360 },
};
