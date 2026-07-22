// Minimal landing page. The backend is API + share pages; this is just a
// friendly root so the deployment doesn't 404 at "/".

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        textAlign: "center",
      }}
    >
      <div>
        <div
          style={{
            color: "var(--primary)",
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: 1,
            fontSize: 14,
          }}
        >
          Spwit
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "8px 0" }}>
          Split the tab, settle up.
        </h1>
        <p style={{ color: "var(--text-dim)", maxWidth: 420, margin: "0 auto" }}>
          Scan a receipt, tap who had what, and send everyone their share.
          Open a link someone sent you to see your split.
        </p>
      </div>
    </main>
  );
}
