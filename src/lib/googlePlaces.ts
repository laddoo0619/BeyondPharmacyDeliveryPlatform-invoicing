const VANCOUVER_BIAS = {
  circle: {
    center: {
      latitude: 49.2827,
      longitude: -123.1207,
    },
    radius: 85000,
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
