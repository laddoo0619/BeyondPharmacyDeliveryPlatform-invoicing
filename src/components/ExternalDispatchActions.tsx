"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useConfirm } from "@/components/ui/DialogsProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { cn, dangerLinkButton, linkButton } from "@/lib/portalStyles";

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
  const confirm = useConfirm();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  if (currentStatus === "CANCELLED") {
    return (
      <span className="text-xs font-semibold text-ink">
        Cancelled
      </span>
    );
  }

  if (currentStatus === "DISPATCH_FAILED" && dispatchId) {
    const retryDispatch = async () => {
      if (
        !(await confirm(
          "Retry sending this delivery to Spoke? The original request identity is reused, so this cannot create a duplicate stop."
        ))
      ) {
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/${storeSlug}/external-dispatches/${dispatchId}/retry`,
          { method: "POST" }
        );

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          toast.error(data?.error || "Failed to retry Spoke handoff");
          return;
        }

        router.refresh();
      } catch {
        toast.error("Network error — the retry may not have been sent. Refresh and check the handoff status.");
      } finally {
        setLoading(false);
      }
    };

    return (
      <button
        onClick={retryDispatch}
        disabled={loading}
        className={cn(linkButton, "text-xs")}
      >
        {loading ? "Retrying..." : "Retry Spoke"}
      </button>
    );
  }

  if (!canCancel || !dispatchId || !CANCELLABLE_EXTERNAL_STATUSES.has(currentStatus)) {
    return (
      <span className="text-xs font-semibold text-ink">
        External handoff
      </span>
    );
  }

  const cancelDispatch = async () => {
    if (
      !(await confirm({
        message: "Cancel this unassigned Spoke handoff? This removes it from Anchor's unassigned queue.",
        tone: "danger",
      }))
    ) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/${storeSlug}/external-dispatches/${dispatchId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Failed to cancel Spoke handoff");
        return;
      }

      router.refresh();
    } catch {
      toast.error("Network error — the cancellation may not have been sent. Refresh and check the handoff status.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={cancelDispatch}
      disabled={loading}
      className={cn(dangerLinkButton, "text-xs")}
    >
      {loading ? "Cancelling..." : "Cancel Spoke"}
    </button>
  );
}
