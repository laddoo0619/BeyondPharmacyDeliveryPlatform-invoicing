"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { MARKER_CLASSES, type MarkerKind } from "@/lib/statusTheme";
import { cn } from "@/lib/portalStyles";

// In-app replacement for window.alert(): the same message, as a toast.
// Errors stay until dismissed (an alert had to be acknowledged too);
// confirmations clear themselves.

interface Toast {
  id: number;
  kind: MarkerKind;
  message: string;
}

interface ToastApi {
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const AUTO_DISMISS_MS = 6000;
const MAX_TOASTS = 4;

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast needs <Providers> above it");
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (kind: MarkerKind, message: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, kind, message }].slice(-MAX_TOASTS));
      if (kind !== "error") setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      error: (message) => show("error", message),
      success: (message) => show("success", message),
      info: (message) => show("info", message),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-60 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.kind === "error" ? "alert" : "status"}
            className={cn(
              "toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-row border border-hairline px-4 py-3 text-sm font-medium text-navy shadow-lift",
              toast.kind === "error" ? "bg-blush" : "bg-white"
            )}
          >
            <span
              aria-hidden="true"
              className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", MARKER_CLASSES[toast.kind])}
            />
            <p className="min-w-0 flex-1 whitespace-pre-line">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss"
              className="-my-1 -mr-1 shrink-0 rounded-full px-2 py-1 text-base leading-none text-navy transition-colors duration-[220ms] hover:bg-panel-cream"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
