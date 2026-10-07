import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import RemindersView from "./RemindersView";
import { resolveStore } from "@/lib/store";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";
import { listReminders, toReminderView } from "@/lib/reminders";

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
    listReminders(store.id),
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
    <RemindersView
      storeSlug={store.slug}
      profiles={profiles}
      reminders={reminders.map((r) => toReminderView(r, dayStart))}
    />
  );
}
