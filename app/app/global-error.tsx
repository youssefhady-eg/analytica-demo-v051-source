"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It must
 * render its own <html>/<body>, so styling here is intentionally minimal and
 * inlined — it can't rely on the app's providers.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#070b12",
          color: "#f1f5f9",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 480, padding: 24 }}>
          <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>Analytica failed to load</h1>
          <p style={{ color: "#94a3b8", margin: "0 0 20px" }}>
            The page couldn&apos;t start. Reload to try again.
          </p>
          <button
            onClick={reset}
            style={{
              background: "#22d3ee",
              color: "#020617",
              border: 0,
              borderRadius: 8,
              padding: "10px 18px",
              fontFamily: "ui-monospace, monospace",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
          {error.digest && (
            <p style={{ marginTop: 20, fontSize: 12, color: "#64748b" }}>ref: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
