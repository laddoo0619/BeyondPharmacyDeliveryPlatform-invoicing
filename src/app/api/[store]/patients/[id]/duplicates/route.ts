import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { requireStoreAdmin } from "@/lib/storeAccess";
import {
  formatRecurringDayList,
  normalizeName,
  parseRecurringActiveDays,
} from "@/lib/recurringDuplicateGuard";
import { phonesConflict, sameAddress, samePersonName } from "@/lib/patientRecords";

// Other patient records under the same name — usually the same person
// re-entered after a move, which is how old addresses pile up on a name.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;

  const patient = await prisma.patient.findFirst({
    where: { id, storeId: access.store.id },
    select: { id: true, name: true, phone: true, address: true, city: true, postalCode: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const tokens = normalizeName(patient.name).split(" ").filter(Boolean);
  // The selected patient's current (default) address: the merge confirmation
  // states plainly that this is the address that stays the default.
  const current = { address: patient.address, city: patient.city, postalCode: patient.postalCode };

  if (tokens.length === 0) return NextResponse.json({ current, duplicates: [] });

  // Narrow in the database to names containing EVERY token — filtering on a
  // single token would let a common surname (Singh, Kaur, Gill) fill the cap
  // below and hide the real duplicate — then apply the exact token-set
  // comparison in code ("Kaur, Simran" = "Simran Kaur").
  const candidates = (
    await prisma.patient.findMany({
      where: {
        storeId: access.store.id,
        id: { not: patient.id },
        AND: tokens.map((token) => ({
          name: { contains: token, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        city: true,
        postalCode: true,
        createdAt: true,
        _count: { select: { orders: true } },
        orders: { select: { scheduledDate: true }, orderBy: { scheduledDate: "desc" }, take: 1 },
        recurringOrders: {
          where: { isActive: true },
          select: { id: true, deliveryAddress: true, deliveryCity: true, activeDays: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  ).filter((candidate) => samePersonName(candidate.name, patient.name));

  if (candidates.length === 0) return NextResponse.json({ current, duplicates: [] });

  // Anchor deliveries have no relation to Patient, so count them separately.
  const dispatchStats = await prisma.externalDispatch.groupBy({
    by: ["patientId"],
    where: { storeId: access.store.id, patientId: { in: candidates.map((c) => c.id) } },
    _count: { _all: true },
    _max: { scheduledDate: true },
  });
  const statsByPatient = new Map(dispatchStats.map((s) => [s.patientId, s]));

  const duplicates = candidates.map((candidate) => {
    const stats = statsByPatient.get(candidate.id);
    const lastOrder = candidate.orders[0]?.scheduledDate ?? null;
    const lastDispatch = stats?._max.scheduledDate ?? null;
    const lastActivity =
      lastOrder && lastDispatch
        ? (lastOrder > lastDispatch ? lastOrder : lastDispatch)
        : lastOrder ?? lastDispatch;

    return {
      id: candidate.id,
      name: candidate.name,
      phone: candidate.phone,
      address: candidate.address,
      city: candidate.city,
      postalCode: candidate.postalCode,
      createdAt: candidate.createdAt.toISOString(),
      orderCount: candidate._count.orders,
      dispatchCount: stats?._count._all ?? 0,
      lastActivity: lastActivity ? lastActivity.toISOString() : null,
      activeRecurring: candidate.recurringOrders.map((profile) => ({
        id: profile.id,
        deliveryAddress: profile.deliveryAddress,
        deliveryCity: profile.deliveryCity,
        days: formatRecurringDayList(parseRecurringActiveDays(profile.activeDays) ?? []),
      })),
      // Two different people can share a name; surface the evidence.
      phoneConflict: phonesConflict(candidate.phone, patient.phone),
      sameAddressAsThisPatient: sameAddress(candidate, patient),
    };
  });

  return NextResponse.json({ current, duplicates });
}
