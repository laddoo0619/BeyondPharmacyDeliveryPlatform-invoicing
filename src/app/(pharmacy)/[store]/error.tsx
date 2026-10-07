"use client";

import { primaryButton } from "@/lib/portalStyles";

export default function PharmacyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md rounded-card border border-hairline bg-white p-6 shadow-soft">
        <h2 className="text-card-title font-extrabold text-navy mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-ink mb-4">
          There was an unexpected error. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={reset}
          className={primaryButton}
        >
          Try Again
        </button>
        {error.digest && (
          <p className="mt-3 text-xs text-muted">Error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
