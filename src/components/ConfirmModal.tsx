"use client";

import { useId, useRef } from "react";
import Modal from "@/components/ui/Modal";
import {
  dangerButton,
  primaryButton,
  secondaryButton,
  sectionTitle,
} from "@/lib/portalStyles";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // "danger" draws the confirm button as a destructive action.
  tone?: "default" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open={open}
      onClose={onCancel}
      dismissible={!loading}
      labelledBy={titleId}
      describedBy={messageId}
      initialFocusRef={cancelRef}
    >
      <div className="px-6 pb-6 pt-3 sm:pt-6">
        <h3 id={titleId} className={sectionTitle}>{title}</h3>
        <p id={messageId} className="mt-2 text-sm font-medium text-ink">{message}</p>
        <div className="mt-6 flex flex-wrap gap-3 justify-end">
          <button
            ref={cancelRef}
            onClick={onCancel}
            disabled={loading}
            className={secondaryButton}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={tone === "danger" ? dangerButton : primaryButton}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
