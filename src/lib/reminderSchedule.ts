import { vancouverHour } from "./vancouverDate";

// Staff pack the day's deliveries in the morning; 10 AM Vancouver is late
// enough that the day's orders exist and early enough to still act on a
// reminder before the run leaves. Client-safe (no database imports) so the
// popup shares the exact rule the server uses.
export const REMINDER_HOUR = 10;

// Due from 10 AM until end of day, not only during the 10 AM hour: someone who
// logs in at 2 PM with reminders outstanding must still see them.
export function isReminderDue(now: Date = new Date()) {
  return vancouverHour(now) >= REMINDER_HOUR;
}
