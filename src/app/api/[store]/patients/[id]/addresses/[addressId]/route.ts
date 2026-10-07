import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { cleanAddressInput } from "@/lib/patientAddressRecords";
import { requireStoreAdmin } from "@/lib/storeAccess";
import { getVancouverDeliveryDateInfo } from "@/lib/cron";
import {
  formatRecurringDayList,
  parseRecurringActiveDays,
} from "@/lib/recurringDuplicateGuard";
import {
  ADDRESS_DELETION_BLOCKER_MESSAGES,
  SETTLED_DISPATCH_STATUSES,
  SETTLED_ORDER_STATUSES,
  getAddressDeletionBlocker,
  recurringProfileUsesAddress,
} from "@/lib/patientRecords";

const updateAddressSchema = z.object({
  address: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().min(1),
  label: z.string().optional(),
  isDefault: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string; addressId: string }> }
) {
  const { store: storeSlug, id: patientId, addressId } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = updateAddressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid data", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, storeId: store.id },
    select: { id: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const existingAddress = await prisma.address.findFirst({
    where: { id: addressId, patientId },
  });

  if (!existingAddress) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const data = cleanAddressInput(parsed.data);

  const updatedAddress = await prisma.$transaction(async (tx) => {
    if (parsed.data.isDefault) {
      await tx.address.updateMany({
        where: { patientId, isDefault: true, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await tx.address.update({
      where: { id: addressId },
      data: {
        label: data.label,
        address: data.address,
        city: data.city,
        postalCode: data.postalCode,
        ...(parsed.data.isDefault !== undefined
          ? { isDefault: parsed.data.isDefault }
          : {}),
      },
    });

    if (updated.isDefault) {
      await tx.patient.update({
        where: { id: patientId },
        data: {
          address: updated.address,
          city: updated.city,
          postalCode: updated.postalCode,
        },
      });
    }

    return updated;
  });

  return NextResponse.json(updatedAddress);
}

// Removes a saved address. Past deliveries are unaffected: each Order and
// ExternalDispatch keeps its own copy of the address text, and Order's link to
// the saved address is nulled by its ON DELETE SET NULL foreign key.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string; addressId: string }> }
) {
  const { store: storeSlug, id: patientId, addressId } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;
  const store = access.store;

  const patient = await prisma.patient.findFirst({
    where: { id: patientId, storeId: store.id },
    select: { id: true, name: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const address = await prisma.address.findFirst({
    where: { id: addressId, patientId },
  });
  if (!address) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  const blocker = getAddressDeletionBlocker({
    isDefault: address.isDefault,
    addressCount: await prisma.address.count({ where: { patientId } }),
  });
  if (blocker) {
    return NextResponse.json(
      { error: ADDRESS_DELETION_BLOCKER_MESSAGES[blocker], blocked: blocker },
      { status: 409 }
    );
  }

  // Deleting the saved address does not redirect anything already pointed at
  // it: recurring profiles store their own address text, and upcoming
  // deliveries were created with it. When a patient has moved, those are what
  // actually send medication to the old place, so make staff look at them.
  if (req.nextUrl.searchParams.get("confirmInUse") !== "1") {
    const fromToday = { gte: getVancouverDeliveryDateInfo().dayStart };
    const [activeProfiles, upcomingOrders, upcomingDispatches] = await Promise.all([
      prisma.recurringOrder.findMany({
        where: { storeId: store.id, isActive: true },
        select: {
          id: true,
          patientId: true,
          patientName: true,
          deliveryAddress: true,
          deliveryCity: true,
          deliveryPostalCode: true,
          activeDays: true,
        },
      }),
      prisma.order.count({
        where: {
          storeId: store.id,
          deliveryAddressId: address.id,
          scheduledDate: fromToday,
          status: { notIn: SETTLED_ORDER_STATUSES },
        },
      }),
      prisma.externalDispatch.count({
        where: {
          storeId: store.id,
          deliveryAddressId: address.id,
          scheduledDate: fromToday,
          status: { notIn: SETTLED_DISPATCH_STATUSES },
        },
      }),
    ]);

    const usingProfiles = activeProfiles.filter((profile) =>
      recurringProfileUsesAddress(profile, patient, address)
    );
    const upcomingDeliveries = upcomingOrders + upcomingDispatches;

    if (usingProfiles.length > 0 || upcomingDeliveries > 0) {
      const parts: string[] = [];
      if (usingProfiles.length > 0) {
        const days = usingProfiles
          .map((p) => formatRecurringDayList(parseRecurringActiveDays(p.activeDays) ?? []))
          .join("; ");
        parts.push(
          `${usingProfiles.length} active recurring profile${usingProfiles.length === 1 ? "" : "s"} (${days})`
        );
      }
      if (upcomingDeliveries > 0) {
        parts.push(
          `${upcomingDeliveries} upcoming deliver${upcomingDeliveries === 1 ? "y" : "ies"}`
        );
      }

      return NextResponse.json(
        {
          inUse: true,
          recurringProfiles: usingProfiles.length,
          upcomingDeliveries,
          error: `This address is still used by ${parts.join(" and ")}. Deleting the saved address does not change them — if the patient has moved, update them on the Recurring and Orders pages.`,
        },
        { status: 409 }
      );
    }
  }

  // Locking the patient row serializes concurrent deletes for the same
  // patient, so two staff can't each remove "one of two" addresses and leave
  // none. The count and default checks are repeated under the lock.
  const outcome = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Patient" WHERE id = ${patient.id} FOR UPDATE`;

    const current = await tx.address.findFirst({
      where: { id: address.id, patientId },
      select: { isDefault: true },
    });
    if (!current) return { status: 404 as const };

    const lockedBlocker = getAddressDeletionBlocker({
      isDefault: current.isDefault,
      addressCount: await tx.address.count({ where: { patientId } }),
    });
    if (lockedBlocker) return { status: 409 as const, blocker: lockedBlocker };

    // Conditional on isDefault: false, so an address made the default by a
    // concurrent edit can never be deleted out from under the patient record.
    const deleted = await tx.address.deleteMany({
      where: { id: address.id, patientId, isDefault: false },
    });
    if (deleted.count === 0) {
      return { status: 409 as const, blocker: "DEFAULT_ADDRESS" as const };
    }

    // ExternalDispatch has no foreign key to Address; clear the link the same
    // way Order's ON DELETE SET NULL does instead of leaving a dangling id.
    await tx.externalDispatch.updateMany({
      where: { storeId: store.id, deliveryAddressId: address.id },
      data: { deliveryAddressId: null },
    });

    return { status: 200 as const };
  });

  if (outcome.status === 404) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }
  if (outcome.status === 409) {
    return NextResponse.json(
      { error: ADDRESS_DELETION_BLOCKER_MESSAGES[outcome.blocker], blocked: outcome.blocker },
      { status: 409 }
    );
  }

  return NextResponse.json({ ok: true });
}
