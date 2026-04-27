import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createAutocompleteRequest,
  getGoogleMapsApiKey,
  getGooglePlacesFailure,
  parseGoogleSuggestions,
} from "@/lib/googlePlaces";
import { resolveStore } from "@/lib/store";

const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const AUTOCOMPLETE_FIELD_MASK =
  "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text";

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

  const input = req.nextUrl.searchParams.get("input")?.trim() || "";
  const sessionToken = req.nextUrl.searchParams.get("sessionToken")?.trim() || "";

  if (input.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  if (!sessionToken) {
    return NextResponse.json({ error: "sessionToken is required" }, { status: 400 });
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return NextResponse.json({
      suggestions: [],
      unavailable: true,
      reason: "missing_key",
      message: "Google Places API key is not available in this deployment.",
    });
  }

  const googleRes = await fetch(AUTOCOMPLETE_URL, {
    method: "POST",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": AUTOCOMPLETE_FIELD_MASK,
    },
    body: JSON.stringify(createAutocompleteRequest(input, sessionToken)),
  });

  if (!googleRes.ok) {
    const failure = await getGooglePlacesFailure(
      googleRes,
      "Google address suggestions are unavailable."
    );
    return NextResponse.json({
      suggestions: [],
      unavailable: true,
      ...failure,
    });
  }

  const body = await googleRes.json();
  return NextResponse.json({ suggestions: parseGoogleSuggestions(body) });
}
