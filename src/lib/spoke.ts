import crypto from "crypto";

const DEFAULT_API_BASE_URL = "https://api.getcircuit.com/public/v0.2b";
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_OPTIMIZATION_MAX_WAIT_MS = 120000;
const OPTIMIZATION_POLL_MS = 5000;

export class SpokeDispatchError extends Error {
  statusCode: number;
  responsePayload: unknown;
  workflowStep: string;

  constructor(
    message: string,
    statusCode = 502,
    responsePayload: unknown = null,
    workflowStep = "SPOKE_REQUEST"
  ) {
    super(message);
    this.name = "SpokeDispatchError";
    this.statusCode = statusCode;
    this.responsePayload = responsePayload;
    this.workflowStep = workflowStep;
  }
}

export interface SpokeDateParts {
  year: number;
  month: number;
  day: number;
}

export interface SpokeOrderInput {
  idempotencyKey: string;
  patientId: string | null;
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
  scheduledDateKey: string;
}

export interface SpokeRequestResult<T = unknown> {
  requestPayload: unknown;
  responsePayload: T;
}

export interface SpokePlanResult extends SpokeRequestResult {
  planId: string;
}

export interface SpokeStopResult extends SpokeRequestResult {
  stopId: string;
  pending: boolean;
}

export interface SpokeOperationResult extends SpokeRequestResult {
  operationId: string;
}

export interface SpokeConfig {
  apiBaseUrl: string;
  apiKey: string;
  spokeDriverId: string;
  timeoutMs: number;
  optimizationMaxWaitMs: number;
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

export function parseScheduledDateKey(value: string, fallback: Date) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : fallback.toISOString().slice(0, 10);
}

export function spokeDatePartsFromKey(dateKey: string): SpokeDateParts {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

export function spokePlanDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function buildSpokePlanKey(input: {
  storeId: string;
  providerUserId: string | null;
  scheduledDateKey: string;
}) {
  return [
    "SPOKE",
    input.storeId,
    input.providerUserId ?? "external-provider",
    input.scheduledDateKey,
  ].join(":");
}

export function buildSpokePlanTitle(input: {
  storeName: string;
  providerName: string | null;
  scheduledDateKey: string;
}) {
  return `${input.storeName} - ${input.providerName ?? "Spoke"} - ${input.scheduledDateKey}`;
}

export function buildSpokePlanPayload(input: {
  title: string;
  starts: SpokeDateParts;
  spokeDriverId: string;
}) {
  return {
    title: input.title,
    starts: input.starts,
    drivers: [input.spokeDriverId],
  };
}

export function buildSpokeStopPayload(input: SpokeOrderInput, spokeDriverId: string) {
  const notes = [
    input.instructions,
    `Zone: ${input.deliveryZoneName}`,
    `Scheduled date: ${input.scheduledDateKey}`,
    `Store: ${input.store.name}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    address: {
      addressName: input.patientName,
      addressLineOne: input.deliveryAddress,
      city: input.deliveryCity,
      state: "BC",
      zip: input.deliveryPostalCode,
      country: "CA",
    },
    recipient: {
      externalId: input.patientId ?? input.idempotencyKey,
      phone: input.patientPhone,
      name: input.patientName,
    },
    orderInfo: {
      products: ["Pharmacy delivery"],
      sellerOrderId: input.idempotencyKey,
      sellerName: input.store.name,
    },
    allowedDrivers: [spokeDriverId],
    activity: "delivery",
    packageCount: 1,
    notes,
  };
}

function parsePositiveEnvInt(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getSpokeConfig(): SpokeConfig {
  const apiBaseUrl = (process.env.SPOKE_API_BASE_URL ?? DEFAULT_API_BASE_URL).trim().replace(/\/$/, "");
  const apiKey = process.env.SPOKE_API_KEY?.trim();
  const spokeDriverId = process.env.SPOKE_DRIVER_ID?.trim();

  if (!apiKey || !spokeDriverId) {
    throw new SpokeDispatchError(
      "Spoke integration is not configured. Please set SPOKE_API_KEY and SPOKE_DRIVER_ID.",
      500,
      null,
      "SETUP"
    );
  }

  if (!/^drivers\/[A-Za-z0-9_-]{1,50}$/.test(spokeDriverId)) {
    throw new SpokeDispatchError(
      "SPOKE_DRIVER_ID must use Spoke's drivers/<id> format.",
      500,
      null,
      "SETUP"
    );
  }

  return {
    apiBaseUrl,
    apiKey,
    spokeDriverId,
    timeoutMs: parsePositiveEnvInt("SPOKE_TIMEOUT_MS", DEFAULT_TIMEOUT_MS),
    optimizationMaxWaitMs: parsePositiveEnvInt(
      "SPOKE_OPTIMIZATION_MAX_WAIT_MS",
      DEFAULT_OPTIMIZATION_MAX_WAIT_MS
    ),
  };
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

function pathToUrl(config: SpokeConfig, path: string) {
  return `${config.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

async function spokeRequest<T>(
  config: SpokeConfig,
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: unknown;
    workflowStep: string;
    idempotencyKey?: string;
  }
): Promise<SpokeRequestResult<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;

    const response = await fetch(pathToUrl(config, path), {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
    const responsePayload = await parseResponseBody(response);

    if (!response.ok) {
      throw new SpokeDispatchError(
        `Spoke ${options.workflowStep} failed with status ${response.status}.`,
        502,
        responsePayload,
        options.workflowStep
      );
    }

    return {
      requestPayload: options.body ?? null,
      responsePayload: responsePayload as T,
    };
  } catch (error) {
    if (error instanceof SpokeDispatchError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SpokeDispatchError(
        `Spoke ${options.workflowStep} request timed out.`,
        502,
        null,
        options.workflowStep
      );
    }

    throw new SpokeDispatchError(
      error instanceof Error ? error.message : `Spoke ${options.workflowStep} request failed.`,
      502,
      null,
      options.workflowStep
    );
  } finally {
    clearTimeout(timeout);
  }
}

function objectPayload(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readString(value: unknown, field: string) {
  const payload = objectPayload(value);
  const read = payload?.[field];
  return typeof read === "string" && read.trim() ? read.trim() : null;
}

export async function createSpokePlan(
  config: SpokeConfig,
  input: {
    title: string;
    starts: SpokeDateParts;
    idempotencyKey: string;
  }
): Promise<SpokePlanResult> {
  const requestPayload = buildSpokePlanPayload({
    title: input.title,
    starts: input.starts,
    spokeDriverId: config.spokeDriverId,
  });
  const result = await spokeRequest(config, "/plans", {
    method: "POST",
    body: requestPayload,
    workflowStep: "CREATE_PLAN",
    idempotencyKey: `${input.idempotencyKey}:plan`,
  });
  const planId = readString(result.responsePayload, "id");

  if (!planId) {
    throw new SpokeDispatchError(
      "Spoke created a plan but did not return a plan id.",
      502,
      result.responsePayload,
      "CREATE_PLAN"
    );
  }

  return { ...result, planId };
}

export async function createSpokeStop(
  config: SpokeConfig,
  input: {
    planId: string;
    stopPayload: Record<string, unknown>;
    live: boolean;
    idempotencyKey: string;
  }
): Promise<SpokeStopResult> {
  const workflowStep = input.live ? "LIVE_CREATE_STOP" : "CREATE_STOP";
  const result = await spokeRequest<Record<string, unknown>>(config, `/${input.planId}/stops${input.live ? ":liveCreate" : ""}`, {
    method: "POST",
    body: input.stopPayload,
    workflowStep,
    idempotencyKey: `${input.idempotencyKey}:stop`,
  });
  const response = objectPayload(result.responsePayload);
  const stop = objectPayload(input.live ? response?.stop : response);
  const stopId = typeof stop?.id === "string" ? stop.id : null;

  if (!stopId) {
    throw new SpokeDispatchError(
      "Spoke could not create the delivery stop.",
      502,
      result.responsePayload,
      workflowStep
    );
  }

  return {
    ...result,
    stopId,
    pending: response?.pending === true,
  };
}

export async function optimizeSpokePlan(
  config: SpokeConfig,
  input: {
    planId: string;
    live: boolean;
    idempotencyKey: string;
  }
): Promise<SpokeOperationResult> {
  const workflowStep = input.live ? "REOPTIMIZE_PLAN" : "OPTIMIZE_PLAN";
  const result = await spokeRequest(config, `/${input.planId}:${input.live ? "reoptimize" : "optimize"}`, {
    method: "POST",
    body: input.live ? { optimizationType: "reorder_changed_stops" } : undefined,
    workflowStep,
    idempotencyKey: `${input.idempotencyKey}:optimize`,
  });
  const operationId = readString(result.responsePayload, "id");

  if (!operationId) {
    throw new SpokeDispatchError(
      "Spoke did not return an optimization operation id.",
      502,
      result.responsePayload,
      workflowStep
    );
  }

  return { ...result, operationId };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForSpokeOperation(
  config: SpokeConfig,
  input: {
    operationId: string;
    stopId: string;
  }
) {
  const deadline = Date.now() + config.optimizationMaxWaitMs;
  let lastResult: SpokeRequestResult<Record<string, unknown>> | null = null;

  while (Date.now() <= deadline) {
    const result = await spokeRequest<Record<string, unknown>>(config, `/${input.operationId}`, {
      workflowStep: "POLL_OPTIMIZATION",
    });
    lastResult = result;
    const operation = objectPayload(result.responsePayload);

    if (operation?.done === true) {
      const operationResult = objectPayload(operation.result);
      const code = typeof operationResult?.code === "string" ? operationResult.code : null;
      const message = typeof operationResult?.message === "string" ? operationResult.message : null;

      if (code || message) {
        throw new SpokeDispatchError(
          `Spoke optimization failed${code ? ` with ${code}` : ""}${message ? `: ${message}` : "."}`,
          502,
          result.responsePayload,
          "POLL_OPTIMIZATION"
        );
      }

      const skippedStops = Array.isArray(operationResult?.skippedStops)
        ? operationResult.skippedStops
        : [];
      const skippedCurrentStop = skippedStops.find((skipped) => {
        const skippedPayload = objectPayload(skipped);
        return skippedPayload?.id === input.stopId;
      });

      if (skippedCurrentStop) {
        throw new SpokeDispatchError(
          "Spoke optimization skipped this delivery stop.",
          502,
          result.responsePayload,
          "POLL_OPTIMIZATION"
        );
      }

      return result;
    }

    await delay(Math.min(OPTIMIZATION_POLL_MS, Math.max(1000, deadline - Date.now())));
  }

  throw new SpokeDispatchError(
    "Spoke optimization did not finish before the timeout.",
    502,
    lastResult?.responsePayload ?? null,
    "POLL_OPTIMIZATION"
  );
}

export async function distributeSpokePlan(
  config: SpokeConfig,
  input: {
    planId: string;
    live: boolean;
    idempotencyKey: string;
  }
) {
  const workflowStep = input.live ? "REDISTRIBUTE_PLAN" : "DISTRIBUTE_PLAN";
  return spokeRequest(config, `/${input.planId}:${input.live ? "redistribute" : "distribute"}`, {
    method: "POST",
    workflowStep,
    idempotencyKey: `${input.idempotencyKey}:distribute`,
  });
}

export function verifySpokeSignature(input: {
  rawBody: string;
  signature: string | null;
  secret: string;
}) {
  if (!input.signature) return false;
  const received = input.signature.replace(/^sha256=/i, "").trim();
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;

  const expected = crypto
    .createHmac("sha256", input.secret)
    .update(input.rawBody)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(received, "hex"), Buffer.from(expected, "hex"));
}

export function mapSpokeWebhookStatus(eventType: string, data: Record<string, unknown>) {
  if (eventType === "stop.allocated") return { status: "ALLOCATED" };
  if (eventType === "stop.out_for_delivery") return { status: "IN_TRANSIT" };
  if (eventType === "stop.departed") return { status: "DEPARTED" };
  if (eventType === "stop.attempted_delivery") {
    const deliveryInfo = objectPayload(data.deliveryInfo);
    const succeeded = deliveryInfo?.succeeded === true;
    return {
      status: succeeded ? "DELIVERED" : "DELIVERY_FAILED",
      deliveredAt: succeeded ? new Date() : null,
      failedAt: succeeded ? null : new Date(),
    };
  }
  if (eventType.endsWith(".tracking_link_added")) {
    return { status: "TRACKING_LINK_ADDED" };
  }

  return { status: "WEBHOOK_RECEIVED" };
}
