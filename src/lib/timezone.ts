/**
 * Pacific Time (America/Los_Angeles) utilities.
 *
 * All date boundaries are computed relative to Pacific Time so that
 * admins in BC/WA and drivers in Surrey/Abbotsford see consistent
 * "today" boundaries regardless of the server's system timezone.
 */

const TIMEZONE = "America/Los_Angeles";

/**
 * Get the current date string in Pacific Time (YYYY-MM-DD).
 */
export function getPacificDateString(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Get the current UTC offset for Pacific Time in hours (e.g. -7 for PDT, -8 for PST).
 * Automatically handles DST transitions.
 */
function getPacificOffsetHours(date = new Date()): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    timeZoneName: "shortOffset",
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((p) => p.type === "timeZoneName");
  // tzPart.value is like "GMT-7" or "GMT-8"
  const match = tzPart?.value.match(/GMT([+-]\d+)/);
  return match ? parseInt(match[1]) : -8;
}

/**
 * Get the start and end of "today" in Pacific Time as UTC Date objects.
 * Use for Prisma `where: { scheduledDate: { gte: start, lt: end } }`.
 */
export function getPacificDayRange(date = new Date()): { start: Date; end: Date } {
  const pacificDate = getPacificDateString(date);
  const offsetHours = getPacificOffsetHours(date);

  // Midnight Pacific Time expressed in UTC
  const start = new Date(`${pacificDate}T00:00:00.000Z`);
  start.setUTCHours(start.getUTCHours() - offsetHours);

  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

/**
 * Get the day-of-week (0=Sun..6=Sat) in Pacific Time.
 */
export function getPacificDayOfWeek(date = new Date()): number {
  const pacificDate = getPacificDateString(date);
  // Parse the YYYY-MM-DD string to get the day of week in Pacific Time
  const [year, month, day] = pacificDate.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Convert a date string (YYYY-MM-DD) to midnight Pacific Time in UTC.
 * Use when storing scheduledDate from the admin date picker.
 */
export function toPacificMidnight(dateStr: string): Date {
  // Get the offset for noon on that day to avoid DST edge cases
  const noonUtc = new Date(`${dateStr}T12:00:00.000Z`);
  const offsetHours = getPacificOffsetHours(noonUtc);

  const midnight = new Date(`${dateStr}T00:00:00.000Z`);
  midnight.setUTCHours(midnight.getUTCHours() - offsetHours);
  return midnight;
}
