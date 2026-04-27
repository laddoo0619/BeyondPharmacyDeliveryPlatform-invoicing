import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getGoogleMapsApiKey,
  getGooglePlacesFailure,
  parseGoogleAddressDetails,
} from "@/lib/googlePlaces";
import { resolveStore } from "@/lib/store";

const DETAILS_FIELD_MASK = "formattedAddress,addressComponents";

export const dynamic = "force-dynamic";

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

  const placeId = req.nextUrl.searchParams.get("placeId")?.trim() || "";
  const sessionToken = req.nextUrl.searchParams.get("sessionToken")?.trim() || "";

  if (!placeId || !sessionToken) {
    return NextResponse.json(
      { error: "placeId and sessionToken are required" },
      { status: 400 }
    );
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Google Places is not configured",
        reason: "missing_key",
        message: "Google Places API key is not available in this deployment.",
      },
      { status: 503 }
    );
  }

  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
  url.searchParams.set("sessionToken", sessionToken);

  const googleRes = await fetch(url, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": DETAILS_FIELD_MASK,
    },
  });

  if (!googleRes.ok) {
    const failure = await getGooglePlacesFailure(
      googleRes,
      "Address details unavailable"
    );
    return NextResponse.json({ error: failure.message, ...failure }, { status: 502 });
  }

  const body = await googleRes.json();
  return NextResponse.json(parseGoogleAddressDetails(body));
}
