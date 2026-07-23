// Per-bill Open Graph image (1200×630) — the rich preview shown in iMessage,
// Slack, etc. when a /s/:id link is shared. Renders the total, name, and people
// count on the Spwit brand canvas.
import { ImageResponse } from "next/og";
import { getBill } from "@/lib/store";
import { computeBreakdown } from "@/lib/split";
import { money } from "@/lib/format";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Spwit split";

const C = {
  bg: "#FFF9F4",
  primary: "#EA580C",
  text: "#26190F",
  dim: "#937B69",
  faint: "#C7B8AB",
};

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getBill(id).catch(() => null);
  const name = stored?.bill.name?.trim();
  const people = stored?.bill.people.length ?? 0;
  const total = stored ? money(computeBreakdown(stored.bill).grandTotalCents) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: C.bg,
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* brand accent stripe */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 18,
            background: C.primary,
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: 3,
            color: C.primary,
          }}
        >
          SPWIT
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {total ? (
            <div style={{ display: "flex", fontSize: 132, fontWeight: 800, color: C.text }}>
              {total}
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: C.text }}>
              Split the tab
            </div>
          )}
          <div style={{ display: "flex", fontSize: 50, fontWeight: 700, color: C.text, marginTop: 8 }}>
            {name || "Your split"}
          </div>
          {total && (
            <div style={{ display: "flex", fontSize: 34, color: C.dim, marginTop: 8 }}>
              Split {people} {people === 1 ? "way" : "ways"}
            </div>
          )}
        </div>

        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.faint }}>
          spwit.app
        </div>
      </div>
    ),
    { ...size },
  );
}
