"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f9fafb" }}>
          <div style={{ maxWidth: "28rem", width: "100%", padding: "2rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#111827", marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: "#4b5563", marginBottom: "1.5rem" }}>
              The application encountered an unexpected error. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginBottom: "1rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
