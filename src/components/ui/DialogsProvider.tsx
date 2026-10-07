"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Modal from "./Modal";
import {
  dangerButton,
  input,
  label,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/portalStyles";

// In-app replacements for window.confirm() and window.prompt(): same wording,
// same "OK" / "Cancel" choices, but drawn with the shared Modal and awaited as
// promises.

export interface ConfirmOptions {
  message: string;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" draws the confirm button as a destructive action.
  tone?: "default" | "danger";
}

export interface DateRangeOptions {
  startLabel: string;
  endLabel: string;
  title?: string;
  confirmLabel?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;
type DateRangeFn = (options: DateRangeOptions) => Promise<DateRange | null>;

const DialogsContext = createContext<{ confirm: ConfirmFn; promptDateRange: DateRangeFn } | null>(
  null
);

function useDialogs() {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("Dialogs need <Providers> above them");
  return context;
}

/** `const confirm = useConfirm(); if (!(await confirm("Delete?"))) return;` */
export function useConfirm() {
  return useDialogs().confirm;
}

/** Resolves to `{ start, end }` (YYYY-MM-DD), or null when cancelled. */
export function usePromptDateRange() {
  return useDialogs().promptDateRange;
}

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [confirmRequest, setConfirmRequest] = useState<ConfirmOptions | null>(null);
  const [rangeRequest, setRangeRequest] = useState<DateRangeOptions | null>(null);
  const resolveConfirm = useRef<((ok: boolean) => void) | null>(null);
  const resolveRange = useRef<((range: DateRange | null) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    // A newer question replaces one left unanswered, which counts as Cancel.
    resolveConfirm.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolveConfirm.current = resolve;
      setConfirmRequest(typeof options === "string" ? { message: options } : options);
    });
  }, []);

  const promptDateRange = useCallback<DateRangeFn>((options) => {
    resolveRange.current?.(null);
    return new Promise<DateRange | null>((resolve) => {
      resolveRange.current = resolve;
      setRangeRequest(options);
    });
  }, []);

  const settleConfirm = useCallback((ok: boolean) => {
    resolveConfirm.current?.(ok);
    resolveConfirm.current = null;
    setConfirmRequest(null);
  }, []);

  const settleRange = useCallback((range: DateRange | null) => {
    resolveRange.current?.(range);
    resolveRange.current = null;
    setRangeRequest(null);
  }, []);

  const api = useMemo(() => ({ confirm, promptDateRange }), [confirm, promptDateRange]);

  return (
    <DialogsContext.Provider value={api}>
      {children}
      {confirmRequest && (
        <ConfirmDialog request={confirmRequest} onSettle={settleConfirm} />
      )}
      {rangeRequest && <DateRangeDialog request={rangeRequest} onSettle={settleRange} />}
    </DialogsContext.Provider>
  );
}

function ConfirmDialog({
  request,
  onSettle,
}: {
  request: ConfirmOptions;
  onSettle: (ok: boolean) => void;
}) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  // Like the browser's confirm(), Enter answers OK — except for destructive
  // questions, where focus starts on Cancel so a stray Enter is harmless.
  const initialFocusRef = request.tone === "danger" ? cancelRef : confirmRef;

  return (
    <Modal
      open
      onClose={() => onSettle(false)}
      labelledBy={request.title ? titleId : messageId}
      describedBy={request.title ? messageId : undefined}
      initialFocusRef={initialFocusRef}
    >
      {/* On a short screen the message scrolls; the answers stay in view. */}
      <div className="flex min-h-0 flex-col px-6 pb-6 pt-3 sm:pt-6">
        <div className="min-h-0 overflow-y-auto">
          {request.title && (
            <h3 id={titleId} className={`${sectionTitle} mb-2`}>
              {request.title}
            </h3>
          )}
          <p id={messageId} className="whitespace-pre-line text-sm font-medium text-ink">
            {request.message}
          </p>
        </div>
        <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3">
          <button ref={cancelRef} type="button" onClick={() => onSettle(false)} className={secondaryButton}>
            {request.cancelLabel ?? "Cancel"}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={request.tone === "danger" ? dangerButton : primaryButton}
          >
            {request.confirmLabel ?? "OK"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function DateRangeDialog({
  request,
  onSettle,
}: {
  request: DateRangeOptions;
  onSettle: (range: DateRange | null) => void;
}) {
  const titleId = useId();
  const startId = useId();
  const endId = useId();
  const startRef = useRef<HTMLInputElement>(null);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (start && end) onSettle({ start, end });
  };

  return (
    <Modal
      open
      onClose={() => onSettle(null)}
      labelledBy={request.title ? titleId : undefined}
      ariaLabel={request.title ? undefined : "Choose dates"}
      initialFocusRef={startRef}
    >
      <form onSubmit={submit} className="flex min-h-0 flex-col px-6 pb-6 pt-3 sm:pt-6">
        {/* Scrolls on a short screen; the padding keeps focus rings unclipped. */}
        <div className="-m-1 min-h-0 overflow-y-auto p-1">
          {request.title && (
            <h3 id={titleId} className={`${sectionTitle} mb-4`}>
              {request.title}
            </h3>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor={startId} className={label}>
                {request.startLabel}
              </label>
              <input
                ref={startRef}
                id={startId}
                type="date"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={input}
              />
            </div>
            <div>
              <label htmlFor={endId} className={label}>
                {request.endLabel}
              </label>
              <input
                id={endId}
                type="date"
                required
                min={start || undefined}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={input}
              />
            </div>
          </div>
        </div>
        <div className="mt-6 flex shrink-0 flex-wrap justify-end gap-3">
          <button type="button" onClick={() => onSettle(null)} className={secondaryButton}>
            Cancel
          </button>
          <button type="submit" className={primaryButton}>
            {request.confirmLabel ?? "OK"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
