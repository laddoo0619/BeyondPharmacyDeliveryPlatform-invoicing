"use client";

export default function PharmacyError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center max-w-md">
        <h2 className="text-lg font-bold text-gray-900 mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          There was an unexpected error. Please try again or contact support if the issue persists.
        </p>
        <button
          onClick={reset}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Try Again
        </button>
        {error.digest && (
          <p className="mt-3 text-xs text-gray-400">Error: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
