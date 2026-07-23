// Default Open Graph image (1200×630) for spwit.app and any page without its own
// (e.g. /v encoded links). Per-bill /s links override this with their own image.
import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Spwit — split the tab, settle up";

const C = { bg: "#FFF9F4", primary: "#EA580C", text: "#26190F", dim: "#937B69", faint: "#C7B8AB" };

export default function Image() {
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
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 18, background: C.primary }} />
        <div style={{ display: "flex", fontSize: 40, fontWeight: 800, letterSpacing: 3, color: C.primary }}>
          SPWIT
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: C.text }}>
            Split the tab,
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 800, color: C.primary }}>
            settle up.
          </div>
          <div style={{ display: "flex", fontSize: 40, color: C.dim, marginTop: 16 }}>
            Snap a receipt, tap who had what, done.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: C.faint }}>spwit.app</div>
      </div>
    ),
    { ...size },
  );
}
