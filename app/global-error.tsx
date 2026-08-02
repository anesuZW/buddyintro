"use client";

/**
 * Root error boundary — catches failures in root layout.
 * Never renders stack traces or internal error.message.
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
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
          background: "#0f1419",
          color: "#f4f6f8",
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0 }}>
            BuddyIntro hit a snag
          </h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginTop: 12, lineHeight: 1.5 }}>
            Something unexpected happened. Your data is safe — try again in a moment.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 11, opacity: 0.45, marginTop: 8 }}>
              Ref: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              border: 0,
              borderRadius: 12,
              padding: "10px 18px",
              background: "#3b82f6",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
