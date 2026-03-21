"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const BASE_INTERVAL = 15_000;
const MAX_INTERVAL = 60_000;

export default function DeliveryPoller() {
  const router = useRouter();
  const [offline, setOffline] = useState(false);
  const [failures, setFailures] = useState(0);

  const poll = useCallback(async () => {
    try {
      // Light connectivity check before refresh
      const res = await fetch("/api/health", { method: "HEAD" });
      if (!res.ok) throw new Error("Health check failed");
      router.refresh();
      setOffline(false);
      setFailures(0);
    } catch {
      setFailures((f) => f + 1);
      setOffline(true);
    }
  }, [router]);

  useEffect(() => {
    // Backoff: 15s, 30s, 60s max
    const interval = Math.min(BASE_INTERVAL * Math.pow(2, failures), MAX_INTERVAL);
    const timer = setInterval(poll, interval);
    return () => clearInterval(timer);
  }, [poll, failures]);

  // Listen for browser online/offline events
  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      setFailures(0);
      router.refresh();
    };
    const goOffline = () => setOffline(true);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [router]);

  if (!offline) return null;

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-4 text-sm text-yellow-800">
      Connection lost. Data may be outdated. Retrying...
    </div>
  );
}
