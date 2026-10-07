import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveStore } from "@/lib/store";
import { requireStoreAdmin } from "@/lib/storeAccess";
import {
  formatRecurringDayList,
  parseRecurringActiveDays,
} from "@/lib/recurringDuplicateGuard";
import { planAddressMerge, sameAddress, samePersonName } from "@/lib/patientRecords";

class MergeConflict extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/**
 * Merges a duplicate patient record (the source) INTO this patient (the
 * target, `[id]`). Every delivery, recurring profile and address on the
 * source moves to the target, then the source record is removed. Nothing is
 * lost: deliveries keep their own copy of the address they were sent to.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; id: string }> }
) {
  const { store: storeSlug, id: targetId } = await params;
  const access = await requireStoreAdmin(await resolveStore(storeSlug));
  if (access.error) return access.error;
  const storeId = access.store.id;

  const body = await req.json().catch(() => null);
  const sourceId = typeof body?.sourcePatientId === "string" ? body.sourcePatientId : "";
  if (!sourceId) {
    return NextResponse.json({ error: "sourcePatientId is required" }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json({ error: "A patient can't be merged into itself" }, { status: 400 });
  }

  try {
    const summary = await prisma.$transaction(async (tx) => {
      // Lock both rows in a fixed order (no deadlock between opposite merges);
      // a concurrent merge or address delete on either patient waits here.
      await tx.$queryRaw`SELECT id FROM "Patient" WHERE id IN (${targetId}, ${sourceId}) ORDER BY id FOR UPDATE`;

      // Sequential on purpose: an interactive transaction runs on one
      // connection, so its queries must not be issued in parallel.
      const target = await tx.patient.findFirst({
        where: { id: targetId, storeId },
        include: { addresses: true },
      });
      const source = await tx.patient.findFirst({
        where: { id: sourceId, storeId },
        include: { addresses: true },
      });
      if (!target) throw new MergeConflict("Patient not found", 404);
      if (!source) {
        throw new MergeConflict(
          "That record no longer exists — it may already have been merged.",
          404
        );
      }

      // Guard against merging two different people. The screen only offers
      // records with the same name, and the API holds to the same rule.
      if (!samePersonName(source.name, target.name)) {
        throw new MergeConflict(
          "Only records with the same patient name can be merged.",
          409
        );
      }

      let addressesMoved = 0;
      let addressesReused = 0;
      for (const step of planAddressMerge(target.addresses, source.addresses)) {
        if (step.action === "reuse") {
          // Same address already on the target: point history at that one;
          // the source's copy is removed with the source record below.
          await tx.order.updateMany({
            where: { storeId, deliveryAddressId: step.sourceAddressId },
            data: { deliveryAddressId: step.targetAddressId },
          });
          await tx.externalDispatch.updateMany({
            where: { storeId, deliveryAddressId: step.sourceAddressId },
            data: { deliveryAddressId: step.targetAddressId },
          });
          addressesReused++;
        } else {
          // The target keeps its own default; anything brought over is a
          // plain saved address, labelled so staff can tell where it came from.
          const moving = source.addresses.find((a) => a.id === step.sourceAddressId);
          await tx.address.update({
            where: { id: step.sourceAddressId },
            data: {
              patientId: target.id,
              isDefault: false,
              ...(moving?.label === "Primary" ? { label: "Merged" } : {}),
            },
          });
          addressesMoved++;
        }
      }

      const orders = await tx.order.updateMany({
        where: { storeId, patientId: source.id },
        data: { patientId: target.id },
      });
      const recurringProfiles = await tx.recurringOrder.updateMany({
        where: { storeId, patientId: source.id },
        data: { patientId: target.id },
      });
      const dispatches = await tx.externalDispatch.updateMany({
        where: { storeId, patientId: source.id },
        data: { patientId: target.id },
      });

      if (!target.phone && source.phone) {
        await tx.patient.update({ where: { id: target.id }, data: { phone: source.phone } });
      }

      // Cascades only the source addresses that were reused (duplicates);
      // moved ones now belong to the target.
      await tx.patient.delete({ where: { id: source.id } });

      // A recurring profile stores its own address text, so a merge never
      // changes where it delivers. Flag any still pointed somewhere other than
      // this patient's current (default) address — after a move, that is the
      // profile that would keep sending medication to the old place.
      const activeProfiles = await tx.recurringOrder.findMany({
        where: { storeId, patientId: target.id, isActive: true },
        select: {
          id: true,
          deliveryAddress: true,
          deliveryCity: true,
          deliveryPostalCode: true,
          activeDays: true,
        },
      });
      const notAtCurrentAddress = activeProfiles
        .filter(
          (p) =>
            !sameAddress(
              { address: p.deliveryAddress, city: p.deliveryCity, postalCode: p.deliveryPostalCode },
              target
            )
        )
        .map((p) => ({
          id: p.id,
          deliveryAddress: p.deliveryAddress,
          deliveryCity: p.deliveryCity,
          days: formatRecurringDayList(parseRecurringActiveDays(p.activeDays) ?? []),
        }));

      return {
        moved: {
          orders: orders.count,
          recurringProfiles: recurringProfiles.count,
          dispatches: dispatches.count,
          addressesMoved,
          addressesReused,
        },
        activeRecurringProfiles: activeProfiles.length,
        recurringNotAtCurrentAddress: notAtCurrentAddress,
      };
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (err) {
    if (err instanceof MergeConflict) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
