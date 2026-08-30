import { vancouverHour } from "./vancouverDate";

// Staff pack the day's deliveries in the morning; 10 AM Vancouver is late
// enough that the day's orders exist and early enough to still pull items
// before the run leaves. Client-safe (no database imports) so the popup can
// share the exact rule the server uses.
export const FRIDGE_REMINDER_HOUR = 10;

// The reminder is due from 10 AM until end of day, not only during the 10 AM
// hour: someone who logs in at 2 PM with items still unchecked must still be
// reminded.
export function isFridgeReminderDue(now: Date = new Date()) {
  return vancouverHour(now) >= FRIDGE_REMINDER_HOUR;
}
