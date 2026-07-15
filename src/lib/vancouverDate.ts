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
