"use client";

import { useRouter, usePathname } from "next/navigation";
import { useMemo } from "react";
import { cn, primaryButton, secondaryButton } from "@/lib/portalStyles";

function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function DateNavigation({
  currentDate,
}: {
  storeSlug: string;
  currentDate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const { prevDate, nextDate, isToday, isPrevDisabled, isNextDisabled, displayDate } =
    useMemo(() => {
      const selected = new Date(currentDate + "T00:00:00");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const prev = new Date(selected);
      prev.setDate(prev.getDate() - 1);

      const next = new Date(selected);
      next.setDate(next.getDate() + 1);

      const minDate = new Date(today);
      minDate.setDate(minDate.getDate() - 30);

      const maxDate = new Date(today);
      maxDate.setDate(maxDate.getDate() + 7);

      return {
        prevDate: formatDateParam(prev),
        nextDate: formatDateParam(next),
        isToday: selected.getTime() === today.getTime(),
        isPrevDisabled: prev < minDate,
        isNextDisabled: next > maxDate,
        displayDate: selected.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      };
    }, [currentDate]);

  const navigate = (date: string | null) => {
    if (date) {
      router.push(`${pathname}?date=${date}`);
    } else {
      router.push(pathname);
    }
  };

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => navigate(prevDate)}
          disabled={isPrevDisabled}
          className={secondaryButton}
        >
          &larr; Prev
        </button>

        <button
          onClick={() => navigate(null)}
          className={cn(
            isToday
              ? primaryButton
              : secondaryButton
          )}
        >
          Today
        </button>

        <button
          onClick={() => navigate(nextDate)}
          disabled={isNextDisabled}
          className={secondaryButton}
        >
          Next &rarr;
        </button>
      </div>

      {!isToday && (
        <p className="text-center text-sm text-slate-500 mt-2">{displayDate}</p>
      )}
    </div>
  );
}
