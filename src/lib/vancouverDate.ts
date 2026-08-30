// Client-safe (no Node-only imports) Vancouver date helper. The store operates
// on America/Vancouver days; `new Date().toISOString()` is UTC and rolls to
// "tomorrow" at ~5 PM Pacific, which mis-defaults forms and day boundaries.
const DELIVERY_TIME_ZONE = "America/Vancouver";

// en-CA formats as YYYY-MM-DD, matching <input type="date"> values and the
// scheduledDate keys used across the app.
export function vancouverTodayKey(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Vancouver wall-clock hour (0-23). The browser's own clock may be in another
// timezone (or plain wrong), so anything scheduled against the pharmacy's day
// has to be derived this way rather than from getHours().
export function vancouverHour(now: Date = new Date()) {
  const hour = new Intl.DateTimeFormat("en-CA", {
    timeZone: DELIVERY_TIME_ZONE,
    hour: "2-digit",
    hour12: false,
  })
    .formatToParts(now)
    .find((part) => part.type === "hour")?.value;

  // "24" is a valid en-CA rendering of midnight in some runtimes.
  const parsed = Number(hour);
  if (!Number.isFinite(parsed)) return 0;
  return parsed % 24;
}
