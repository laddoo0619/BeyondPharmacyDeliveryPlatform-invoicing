const DEFAULT_TIMEOUT_MS = 10000;

export class SpokeDispatchError extends Error {
  statusCode: number;
  responsePayload: unknown;

  constructor(message: string, statusCode = 502, responsePayload: unknown = null) {
    super(message);
    this.name = "SpokeDispatchError";
    this.statusCode = statusCode;
    this.responsePayload = responsePayload;
  }
}

export interface SpokeOrderInput {
  idempotencyKey: string;
  store: {
    id: string;
    slug: string;
    name: string;
  };
  providerUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  patientName: string;
  patientPhone: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
  deliveryZoneName: string;
  instructions: string | null;
  scheduledDate: Date;
}

export interface SpokeDispatchResult {
  requestPayload: Record<string, unknown>;
  responsePayload: unknown;
  externalReference: string | null;
}

export function getSpokeProviderUserIds() {
  return new Set(
    (process.env.SPOKE_PROVIDER_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  );
}

export function shouldRouteToSpoke(input: {
  assignedDriverId: string | null;
  isExternalProvider: boolean;
  deliveryCompany: string | null;
}) {
  return (
    input.isExternalProvider === true ||
    input.deliveryCompany === "Spoke_Partner" ||
    (input.assignedDriverId
      ? getSpokeProviderUserIds().has(input.assignedDriverId)
      : false)
  );
}

export function buildSpokeOrderPayload(input: SpokeOrderInput) {
  return {
    reference: input.idempotencyKey,
    patient: {
      name: input.patientName,
      phone: input.patientPhone,
    },
    delivery: {
      address: input.deliveryAddress,
      city: input.deliveryCity,
      postal_code: input.deliveryPostalCode,
      zone: input.deliveryZoneName,
      instructions: input.instructions,
      scheduled_date: input.scheduledDate.toISOString(),
    },
    store: {
      id: input.store.id,
      slug: input.store.slug,
      name: input.store.name,
    },
    provider_user: input.providerUser,
    metadata: {
      source: "beyond_pharmacy_delivery_platform",
      idempotency_key: input.idempotencyKey,
    },
  };
}

function parseTimeoutMs() {
  const parsed = Number(process.env.SPOKE_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function getSpokeConfig() {
  const apiUrl = process.env.SPOKE_API_URL?.trim();
  const apiKey = process.env.SPOKE_API_KEY?.trim();

  if (!apiUrl || !apiKey) {
    throw new SpokeDispatchError(
      "Spoke integration is not configured. Please set SPOKE_API_URL and SPOKE_API_KEY.",
      500
    );
  }

  return { apiUrl, apiKey, timeoutMs: parseTimeoutMs() };
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function extractExternalReference(responsePayload: unknown) {
  if (!responsePayload || typeof responsePayload !== "object") return null;
  const payload = responsePayload as Record<string, unknown>;
  const value =
    payload.id ??
    payload.orderId ??
    payload.order_id ??
    payload.deliveryId ??
    payload.delivery_id ??
    payload.reference;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function sendOrderToSpoke(
  input: SpokeOrderInput
): Promise<SpokeDispatchResult> {
  const { apiUrl, apiKey, timeoutMs } = getSpokeConfig();
  const requestPayload = buildSpokeOrderPayload(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": input.idempotencyKey,
      },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    const responsePayload = await parseResponseBody(response);

    if (!response.ok) {
      throw new SpokeDispatchError(
        `Spoke rejected the order with status ${response.status}.`,
        502,
        responsePayload
      );
    }

    return {
      requestPayload,
      responsePayload,
      externalReference: extractExternalReference(responsePayload),
    };
  } catch (error) {
    if (error instanceof SpokeDispatchError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new SpokeDispatchError("Spoke request timed out.", 502);
    }

    throw new SpokeDispatchError(
      error instanceof Error ? error.message : "Failed to contact Spoke.",
      502
    );
  } finally {
    clearTimeout(timeout);
  }
}
