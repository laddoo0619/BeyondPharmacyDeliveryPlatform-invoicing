"use client";

import { primaryButtonFull } from "@/lib/portalStyles";

export default function DriverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-sm rounded-card border border-hairline bg-white p-6 shadow-soft">
        <h2 className="text-card-title font-extrabold text-navy mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-ink mb-4">
          There was a problem loading this page. Please check your connection and try again.
        </p>
        <button
          onClick={reset}
          className={primaryButtonFull}
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
