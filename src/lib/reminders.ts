import { prisma } from "./db";
import { getVancouverDeliveryDateInfo } from "./cron";

export const MAX_REMINDER_NOTE = 300;

export interface ReminderView {
  id: string;
  note: string;
  patientName: string | null;
  remindOn: string;
  repeatIntervalWeeks: number | null;
  completedAt: string | null;
  isOverdue: boolean;
}

// Reminder dates are day keys ("2026-09-04") stored at UTC midnight, matching
// Order.scheduledDate so day comparisons line up across the app.
export function parseReminderDateKey(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toReminderDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addWeeks(date: Date, weeks: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + weeks * 7);
  return next;
}

export function toReminderView(
  reminder: {
    id: string;
    note: string;
    patientName: string | null;
    remindOn: Date;
    repeatIntervalWeeks: number | null;
    completedAt: Date | null;
  },
  todayStart: Date
): ReminderView {
  return {
    id: reminder.id,
    note: reminder.note,
    patientName: reminder.patientName,
    remindOn: toReminderDateKey(reminder.remindOn),
    repeatIntervalWeeks: reminder.repeatIntervalWeeks,
    completedAt: reminder.completedAt ? reminder.completedAt.toISOString() : null,
    isOverdue: !reminder.completedAt && reminder.remindOn < todayStart,
  };
}

// Everything still open and due — today's plus anything overdue. Overdue items
// deliberately keep showing: a reminder that silently expired is the failure
// this feature exists to prevent.
export async function getDueReminders(storeId: string, now = new Date()) {
  const { dayStart, nextDayStart } = getVancouverDeliveryDateInfo(now);

  const reminders = await prisma.reminder.findMany({
    where: {
      storeId,
      completedAt: null,
      remindOn: { lt: nextDayStart },
    },
    orderBy: [{ remindOn: "asc" }, { patientName: "asc" }],
    select: {
      id: true,
      note: true,
      patientName: true,
      remindOn: true,
      repeatIntervalWeeks: true,
      completedAt: true,
    },
  });

  return {
    dateKey: toReminderDateKey(dayStart),
    items: reminders.map((r) => toReminderView(r, dayStart)),
    outstanding: reminders.length,
  };
}
