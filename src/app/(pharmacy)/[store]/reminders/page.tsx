import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { resolveStore } from "@/lib/store";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";
import { toReminderView } from "@/lib/reminders";
import { pageTitle, mutedText } from "@/lib/portalStyles";
import ReminderForm from "./ReminderForm";
import ReminderList from "./ReminderList";

export default async function RemindersPage({
  params,
}: {
  params: Promise<{ store: string }>;
}) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) notFound();

  const { dayStart } = getVancouverDeliveryDateInfo();

  const [reminders, profiles] = await Promise.all([
    prisma.reminder.findMany({
      where: { storeId: store.id },
      orderBy: [{ completedAt: "asc" }, { remindOn: "asc" }],
      take: 200,
      select: {
        id: true,
        note: true,
        patientName: true,
        remindOn: true,
        repeatIntervalWeeks: true,
        completedAt: true,
      },
    }),
    // The patient picker searches the recurring list, so names match the
    // profiles exactly. Small enough (under a few hundred) to filter in the
    // browser without a search round-trip per keystroke.
    prisma.recurringOrder.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: { patientName: "asc" },
      select: {
        id: true,
        patientName: true,
        deliveryAddress: true,
        deliveryCity: true,
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={pageTitle}>Reminders</h1>
        <p className={mutedText}>
          Pop up on the day you choose, from 10 AM onward — fridge items, callbacks,
          anything the team needs to catch before a delivery goes out.
        </p>
      </div>

      <ReminderForm storeSlug={store.slug} profiles={profiles} />
      <ReminderList
        storeSlug={store.slug}
        reminders={reminders.map((r) => toReminderView(r, dayStart))}
      />
    </div>
  );
}
