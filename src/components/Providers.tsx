"use client";

import type { ReactNode } from "react";
import { DialogsProvider } from "./ui/DialogsProvider";
import { ToastProvider } from "./ui/ToastProvider";
import RevealObserver from "./ui/RevealObserver";
import ScrollProgress from "./ui/ScrollProgress";

// App-wide UI services: in-app confirm/prompt dialogs, toasts, scroll reveal
// and the scroll progress bar.
export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <DialogsProvider>
        <ScrollProgress />
        {children}
        <RevealObserver />
      </DialogsProvider>
    </ToastProvider>
  );
}
