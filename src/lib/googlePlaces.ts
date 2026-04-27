const VANCOUVER_BIAS = {
  rectangle: {
    low: {
      latitude: 49.0,
      longitude: -123.35,
    },
    high: {
      latitude: 49.45,
      longitude: -122.25,
    },
  },
};

export interface GooglePlaceSuggestion {
  placeId: string;
  description: string;
}

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

export function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() || null;
}

export async function getGooglePlacesFailure(
  response: Response,
  fallback: string
) {
  const body = await response.text().catch(() => "");
  let message = fallback;

  try {
    const parsed = JSON.parse(body) as {
      error?: { message?: string; status?: string };
    };
    message = parsed.error?.message || parsed.error?.status || fallback;
  } catch {
    if (body.trim()) message = body.trim();
  }

  console.warn("[Google Places]", response.status, message);

  if (response.status === 403) {
    return {
      reason: "key_rejected",
      message:
        "Google rejected the Places API key. Check that Places API is enabled and the key restrictions allow this server-side request.",
    };
  }

  if (response.status === 429) {
    return {
      reason: "rate_limited",
      message: "Google Places quota or rate limit was reached.",
    };
  }

  if (response.status === 400) {
    return {
      reason: "bad_request",
      message: "Google rejected the address lookup request.",
    };
  }

  return {
    reason: "google_error",
    message: fallback,
  };
}

export function createAutocompleteRequest(input: string, sessionToken: string) {
  return {
    input,
    sessionToken,
    includedRegionCodes: ["ca"],
    languageCode: "en",
    regionCode: "ca",
    locationBias: VANCOUVER_BIAS,
  };
}

export function parseGoogleSuggestions(body: unknown): GooglePlaceSuggestion[] {
  if (!body || typeof body !== "object" || !("suggestions" in body)) return [];

  const suggestions = (body as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return [];

  return suggestions.flatMap((suggestion) => {
    if (!suggestion || typeof suggestion !== "object") return [];
    const prediction = (suggestion as { placePrediction?: unknown }).placePrediction;
    if (!prediction || typeof prediction !== "object") return [];

    const placeId = (prediction as { placeId?: unknown }).placeId;
    const text = (prediction as { text?: { text?: unknown } }).text?.text;

    if (typeof placeId !== "string" || typeof text !== "string") return [];
    return [{ placeId, description: text }];
  });
}

function componentText(
  components: GoogleAddressComponent[],
  type: string,
  field: "longText" | "shortText" = "longText"
) {
  const component = components.find((item) => item.types?.includes(type));
  return component?.[field] || component?.longText || component?.shortText || "";
}

export function parseGoogleAddressDetails(body: unknown) {
  if (!body || typeof body !== "object") {
    return { address: "", city: "", postalCode: "", formattedAddress: "" };
  }

  const place = body as {
    addressComponents?: GoogleAddressComponent[];
    formattedAddress?: string;
  };
  const components = Array.isArray(place.addressComponents)
    ? place.addressComponents
    : [];

  const subpremise = componentText(components, "subpremise");
  const streetNumber = componentText(components, "street_number");
  const route = componentText(components, "route");
  const street = [streetNumber, route].filter(Boolean).join(" ").trim();
  const address = [subpremise, street].filter(Boolean).join("-").trim();
  const city =
    componentText(components, "locality") ||
    componentText(components, "postal_town") ||
    componentText(components, "administrative_area_level_3") ||
    componentText(components, "administrative_area_level_2");

  return {
    address,
    city,
    postalCode: componentText(components, "postal_code", "shortText"),
    formattedAddress: place.formattedAddress || "",
  };
}
