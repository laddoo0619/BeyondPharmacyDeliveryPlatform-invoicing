"use client";

import { primaryButton } from "@/lib/portalStyles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="max-w-md w-full space-y-4 p-8 text-center">
        <h1 className="text-2xl font-extrabold tracking-tight text-navy">
          Something went wrong
        </h1>
        <p className="text-ink">
          An error occurred while loading this page. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-muted">Error ID: {error.digest}</p>
        )}
        <button
          onClick={() => reset()}
          className={primaryButton}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
