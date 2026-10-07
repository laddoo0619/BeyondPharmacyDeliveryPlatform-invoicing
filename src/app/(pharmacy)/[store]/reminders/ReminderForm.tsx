"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { card, cn, ctaShadow, input, label, primaryButton, sectionTitle } from "@/lib/portalStyles";
import { BANNER_CLASSES } from "@/lib/statusTheme";
import { vancouverTodayKey } from "@/lib/vancouverDate";

interface Profile {
  id: string;
  patientName: string;
  deliveryAddress: string;
  deliveryCity: string;
}

const MAX_SUGGESTIONS = 8;

export default function ReminderForm({
  storeSlug,
  profiles,
}: {
  storeSlug: string;
  profiles: Profile[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [patientQuery, setPatientQuery] = useState("");
  const [picked, setPicked] = useState<Profile | null>(null);
  const [remindOn, setRemindOn] = useState(() => vancouverTodayKey());
  const [repeatIntervalWeeks, setRepeatIntervalWeeks] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const suggestions = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q || picked) return [];
    return profiles
      .filter((p) => p.patientName.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [patientQuery, picked, profiles]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`/api/${storeSlug}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note,
          // Free text is allowed: a reminder can be about someone who isn't on
          // the recurring list at all.
          patientName: picked?.patientName ?? patientQuery,
          recurringOrderId: picked?.id ?? null,
          remindOn,
          repeatIntervalWeeks: repeatIntervalWeeks || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || "Could not save the reminder");
        return;
      }

      setNote("");
      setPatientQuery("");
      setPicked(null);
      setRepeatIntervalWeeks("");
      router.refresh();
    } catch {
      setError("Network error — the reminder was not saved.");
    } finally {
      setLoading(false);
    }
  };

  const fieldId = useId();

  return (
    <div className={`${card} p-6`}>
      <h2 className={`${sectionTitle} mb-4`}>New Reminder</h2>
      <form onSubmit={submit} className="space-y-3">
        {error && (
          <div role="alert" className={cn("rounded-row px-3 py-2 text-sm", BANNER_CLASSES.error)}>{error}</div>
        )}

        <div className="relative">
          <label htmlFor={`${fieldId}-patient`} className={label}>Patient (search your recurring list)</label>
          <input
            id={`${fieldId}-patient`}
            type="text"
            value={picked ? picked.patientName : patientQuery}
            onChange={(e) => {
              setPicked(null);
              setPatientQuery(e.target.value);
            }}
            placeholder="Start typing a name — or leave blank for a general reminder"
            className={input}
            autoComplete="off"
          />
          {picked && (
            <p className="mt-1 text-xs text-muted">
              {picked.deliveryAddress}, {picked.deliveryCity} —{" "}
              <button
                type="button"
                onClick={() => {
                  setPicked(null);
                  setPatientQuery("");
                }}
                className="font-semibold text-navy hover:underline"
              >
                change
              </button>
            </p>
          )}
          {suggestions.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-row border border-hairline bg-white shadow-lift">
              {suggestions.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked(p);
                      setPatientQuery(p.patientName);
                    }}
                    className="row-hover block w-full px-4 py-2 text-left text-sm"
                  >
                    <span className="font-semibold text-navy">{p.patientName}</span>
                    <span className="block truncate text-xs text-muted">
                      {p.deliveryAddress}, {p.deliveryCity}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label htmlFor={`${fieldId}-note`} className={label}>Reminder *</label>
          <input
            id={`${fieldId}-note`}
            type="text"
            required
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            placeholder="e.g. Fridge item — Ozempic"
            className={input}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label htmlFor={`${fieldId}-date`} className={label}>Remind me on *</label>
            <input
              id={`${fieldId}-date`}
              type="date"
              required
              value={remindOn}
              onChange={(e) => setRemindOn(e.target.value)}
              className={input}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-repeat`} className={label}>Repeat</label>
            <select
              id={`${fieldId}-repeat`}
              value={repeatIntervalWeeks}
              onChange={(e) => setRepeatIntervalWeeks(e.target.value)}
              className={input}
            >
              <option value="">One-off (no repeat)</option>
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
              <option value="4">Every 4 weeks</option>
              <option value="8">Every 8 weeks</option>
              <option value="12">Every 12 weeks</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-muted">
          A repeating reminder schedules its next date automatically when you tick it off.
        </p>

        <button type="submit" disabled={loading} className={cn(primaryButton, ctaShadow)}>
          {loading ? "Saving..." : "Add Reminder"}
        </button>
      </form>
    </div>
  );
}
