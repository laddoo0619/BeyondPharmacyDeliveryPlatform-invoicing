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
      <div className="text-center max-w-md rounded-2xl border border-slate-200/70 bg-white/95 p-6 shadow-[0_18px_45px_rgba(30,58,138,0.08)]">
        <h2 className="text-lg font-bold text-[#1e3a8a] mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          There was an unexpected error. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={reset}
          className={primaryButton}
        >
          Try Again
        </button>
        {error.digest && (
          <p className="mt-3 text-xs text-slate-400">Error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
