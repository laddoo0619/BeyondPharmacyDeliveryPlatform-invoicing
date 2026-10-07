"use client";

import { colors, fontStacks, radii } from "@/styles/tokens";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="antialiased" style={{ margin: 0, fontFamily: fontStacks.sans, WebkitFontSmoothing: "antialiased" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: colors.white }}>
          <div style={{ maxWidth: "28rem", width: "100%", padding: "2rem", textAlign: "center" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", color: colors.navy, marginBottom: "0.5rem" }}>
              Something went wrong
            </h1>
            <p style={{ color: colors.ink, marginBottom: "1.5rem" }}>
              The application encountered an unexpected error. Please try again.
            </p>
            {error.digest && (
              <p style={{ fontSize: "0.75rem", color: colors.muted, marginBottom: "1rem" }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={() => reset()}
              style={{
                padding: "0.75rem 1.5rem",
                backgroundColor: colors.navy,
                color: colors.cream,
                border: "none",
                borderRadius: radii.pill,
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 700,
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
