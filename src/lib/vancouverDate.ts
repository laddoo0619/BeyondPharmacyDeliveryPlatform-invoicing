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

// Calendar arithmetic on a YYYY-MM-DD key. Works on the date itself, not on
// an instant, so daylight-saving changes can't shift the result.
export function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

// From 12:00 PM Vancouver time, new orders default to the next day's delivery.
export const NEXT_DAY_CUTOFF_HOUR = 12;

export function isAfterNextDayCutoff(now: Date = new Date()) {
  return vancouverHour(now) >= NEXT_DAY_CUTOFF_HOUR;
}

/** The delivery date a new order starts with: today before noon, else tomorrow. */
export function defaultDeliveryDateKey(now: Date = new Date()) {
  const today = vancouverTodayKey(now);
  return isAfterNextDayCutoff(now) ? addDaysToDateKey(today, 1) : today;
}

/** "today", "tomorrow" or "on Thu, Oct 8" — for messages about a delivery day. */
export function describeDeliveryDay(dateKey: string, now: Date = new Date()) {
  const today = vancouverTodayKey(now);
  if (dateKey === today) return "today";
  if (dateKey === addDaysToDateKey(today, 1)) return "tomorrow";
  const label = new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return `on ${label}`;
}
