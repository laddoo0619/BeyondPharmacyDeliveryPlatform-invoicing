import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import {
  addressMatchesSearch,
  cleanOptionalText,
  cleanText,
  createPatientWithDefaultAddress,
} from "@/lib/patientAddressRecords";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const search = cleanText(req.nextUrl.searchParams.get("search"));

  const patients = await prisma.patient.findMany({
    where: {
      storeId: store.id,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { address: { contains: search, mode: "insensitive" as const } },
              { city: { contains: search, mode: "insensitive" as const } },
              { postalCode: { contains: search, mode: "insensitive" as const } },
              {
                addresses: {
                  some: {
                    OR: [
                      { address: { contains: search, mode: "insensitive" as const } },
                      { city: { contains: search, mode: "insensitive" as const } },
                      { postalCode: { contains: search, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      addresses: {
        orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      },
    },
    orderBy: { name: "asc" },
    take: 20,
  });

  return NextResponse.json(
    patients.map(({ addresses, ...patient }) => {
      const matchedAddress =
        search && addresses.find((address) => addressMatchesSearch(address, search));
      const primaryAddress = addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;
      const suggestedAddress = matchedAddress || primaryAddress;

      return {
        ...patient,
        matchedAddressId: suggestedAddress?.id ?? null,
        matchedAddress: suggestedAddress
          ? {
              id: suggestedAddress.id,
              label: suggestedAddress.label,
              address: suggestedAddress.address,
              city: suggestedAddress.city,
              postalCode: suggestedAddress.postalCode,
              isDefault: suggestedAddress.isDefault,
            }
          : null,
      };
    })
  );
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const store = await resolveStore(storeSlug);
  if (!store) {
    return NextResponse.json({ error: "Store not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const name = cleanText(body.name);
  const address = cleanText(body.address);
  const city = cleanText(body.city);
  const postalCode = cleanText(body.postalCode);

  if (!name || !address || !city || !postalCode) {
    return NextResponse.json(
      { error: "name, address, city, and postalCode are required" },
      { status: 400 }
    );
  }

  const { patient } = await prisma.$transaction((tx) =>
    createPatientWithDefaultAddress(tx, {
      name,
      phone: cleanOptionalText(body.phone),
      address,
      city,
      postalCode,
      storeId: store.id,
    })
  );

  return NextResponse.json(patient, { status: 201 });
}
