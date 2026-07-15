"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CANCELLABLE_EXTERNAL_STATUSES = new Set([
  "PENDING",
  "STOP_CREATED",
  "SUBMITTED",
]);

interface ExternalDispatchActionsProps {
  dispatchId: string | null;
  currentStatus: string;
  canCancel: boolean;
  storeSlug: string;
}

export default function ExternalDispatchActions({
  dispatchId,
  currentStatus,
  canCancel,
  storeSlug,
}: ExternalDispatchActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (currentStatus === "CANCELLED") {
    return (
      <span className="text-xs font-semibold text-slate-500">
        Cancelled
      </span>
    );
  }

  if (currentStatus === "DISPATCH_FAILED" && dispatchId) {
    const retryDispatch = async () => {
      if (
        !confirm(
          "Retry sending this delivery to Spoke? The original request identity is reused, so this cannot create a duplicate stop."
        )
      ) {
        return;
      }

      setLoading(true);
      const res = await fetch(
        `/api/${storeSlug}/external-dispatches/${dispatchId}/retry`,
        { method: "POST" }
      );
      setLoading(false);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Failed to retry Spoke handoff");
        return;
      }

      router.refresh();
    };

    return (
      <button
        onClick={retryDispatch}
        disabled={loading}
        className="text-xs font-semibold text-[#6f8f72] transition hover:text-[#5f7d62] disabled:opacity-50"
      >
        {loading ? "Retrying..." : "Retry Spoke"}
      </button>
    );
  }

  if (!canCancel || !dispatchId || !CANCELLABLE_EXTERNAL_STATUSES.has(currentStatus)) {
    return (
      <span className="text-xs font-semibold text-slate-500">
        External handoff
      </span>
    );
  }

  const cancelDispatch = async () => {
    if (
      !confirm(
        "Cancel this unassigned Spoke handoff? This removes it from Anchor's unassigned queue."
      )
    ) {
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/${storeSlug}/external-dispatches/${dispatchId}`, {
      method: "DELETE",
    });
    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      alert(data?.error || "Failed to cancel Spoke handoff");
      return;
    }

    router.refresh();
  };

  return (
    <button
      onClick={cancelDispatch}
      disabled={loading}
      className="text-xs font-semibold text-rose-600 transition hover:text-rose-800 disabled:opacity-50"
    >
      {loading ? "Cancelling..." : "Cancel Spoke"}
    </button>
  );
}
