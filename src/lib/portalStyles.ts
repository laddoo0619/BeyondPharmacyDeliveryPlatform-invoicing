export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export const portalShell =
  "min-h-screen bg-gradient-to-br from-white via-sky-50 to-emerald-50 text-slate-700";

export const portalMain =
  "max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8";

export const driverMain = "max-w-lg mx-auto px-4 py-4";

export const card =
  "rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_18px_45px_rgba(30,58,138,0.08)]";

export const cardInteractive =
  "rounded-2xl border border-slate-200/70 bg-white/95 shadow-[0_18px_45px_rgba(30,58,138,0.08)] transition-all hover:-translate-y-0.5 hover:border-[#6f8f72]/40 hover:shadow-[0_20px_50px_rgba(30,58,138,0.12)]";

export const pageTitle = "text-2xl font-bold tracking-tight text-[#1e3a8a]";
export const sectionTitle = "text-lg font-bold text-[#1e3a8a]";
export const mutedText = "text-sm text-slate-500";
export const label = "block text-sm font-medium text-slate-600 mb-1";

export const input =
  "w-full rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#6f8f72] focus:ring-2 focus:ring-[#6f8f72]/20";

export const inputReadOnly =
  "bg-slate-50/90 text-slate-500";

export const primaryButton =
  "rounded-xl bg-[#6f8f72] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5f7d62] disabled:cursor-not-allowed disabled:opacity-50";

export const primaryButtonFull =
  "w-full rounded-xl bg-[#6f8f72] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#5f7d62] disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-[#6f8f72]/40 hover:bg-emerald-50/60 hover:text-[#1e3a8a] disabled:cursor-not-allowed disabled:opacity-50";

export const softButton =
  "rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-200 disabled:opacity-50";

export const dangerButton =
  "rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-50";

export const tableHeader =
  "bg-gradient-to-r from-sky-50/80 to-emerald-50/70 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";

export const tableRow = "transition-colors hover:bg-sky-50/45";

export const emptyState =
  "rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500 shadow-[0_14px_35px_rgba(30,58,138,0.06)]";

export function statusBadgeClasses(status: string) {
  const classes: Record<string, string> = {
    PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
    ASSIGNED: "bg-sky-50 text-sky-700 ring-sky-200",
    PICKED_UP: "bg-teal-50 text-teal-700 ring-teal-200",
    IN_TRANSIT: "bg-violet-50 text-violet-700 ring-violet-200",
    DELIVERED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    FAILED: "bg-rose-50 text-rose-700 ring-rose-200",
    CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    INACTIVE: "bg-slate-100 text-slate-600 ring-slate-200",
    DRAFT: "bg-amber-50 text-amber-700 ring-amber-200",
    FINALIZED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    ADMIN: "bg-sky-50 text-sky-700 ring-sky-200",
    DRIVER: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    HOLD: "bg-violet-50 text-violet-700 ring-violet-200",
    SKIPPED: "bg-orange-50 text-orange-700 ring-orange-200",
  };

  return cn(
    "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
    classes[status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
  );
}
