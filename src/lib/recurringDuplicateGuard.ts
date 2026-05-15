import type { Prisma } from "@prisma/client";

export const RECURRING_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export interface RecurringPersonInput {
  patientId: string | null;
  patientName: string;
  patientPhone: string | null;
  deliveryAddress: string;
  deliveryCity: string;
  deliveryPostalCode: string;
}

export interface RecurringDuplicateInput extends RecurringPersonInput {
  storeId: string;
  activeDays: number[];
}

export interface RecurringDuplicateRecord extends RecurringPersonInput {
  id: string;
  storeId: string;
  activeDays: string;
  createdAt: Date;
}

export interface RecurringDuplicateMatch {
  recurringOrder: RecurringDuplicateRecord;
  overlappingDays: number[];
}

export interface RecurringDuplicateCleanupChange {
  order: RecurringDuplicateRecord;
  duplicateDays: number[];
  remainingDays: number[];
  keptBy: Array<{
    day: number;
    recurringOrderId: string;
    patientId: string | null;
    patientName: string;
    deliveryAddress: string;
    deliveryCity: string;
    deliveryPostalCode: string;
  }>;
}

type RecurringDuplicateClient = {
  recurringOrder: Pick<Prisma.TransactionClient["recurringOrder"], "findMany">;
};

export const recurringDuplicateSelect = {
  id: true,
  storeId: true,
  patientId: true,
  patientName: true,
  patientPhone: true,
  deliveryAddress: true,
  deliveryCity: true,
  deliveryPostalCode: true,
  activeDays: true,
  createdAt: true,
} satisfies Prisma.RecurringOrderSelect;

function normalizeText(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string | null | undefined) {
  const normalized = normalizeText(value);
  if (!normalized) return "";

  const tokens = normalized.split(" ").filter(Boolean);
  return [...tokens].sort().join(" ");
}

const ADDRESS_TOKEN_REPLACEMENTS: Record<string, string> = {
  st: "street",
  str: "street",
  street: "street",
  ave: "avenue",
  av: "avenue",
  avenue: "avenue",
  rd: "road",
  road: "road",
  dr: "drive",
  drive: "drive",
  blvd: "boulevard",
  boulevard: "boulevard",
  ln: "lane",
  lane: "lane",
  ct: "court",
  court: "court",
  pl: "place",
  place: "place",
  cres: "crescent",
  cr: "crescent",
  crescent: "crescent",
  hwy: "highway",
  highway: "highway",
  terr: "terrace",
  terrace: "terrace",
  cir: "circle",
  circle: "circle",
};

function normalizeAddress(value: string | null | undefined) {
  const normalized = normalizeText(value).replace(
    /\b(\d+)\s+([a-z])\b/g,
    "$1$2"
  );
  if (!normalized) return "";

  return normalized
    .split(" ")
    .map((token) => ADDRESS_TOKEN_REPLACEMENTS[token] ?? token)
    .join(" ");
}

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

function normalizePostalCode(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/\s+/g, "").trim();
}

function normalizePersonFallback(input: RecurringPersonInput) {
  return {
    name: normalizeName(input.patientName),
    phone: normalizePhone(input.patientPhone),
    address: normalizeAddress(input.deliveryAddress),
    city: normalizeText(input.deliveryCity),
    postalCode: normalizePostalCode(input.deliveryPostalCode),
  };
}

export function parseRecurringActiveDays(value: unknown) {
  const parsed = typeof value === "string" ? safeParseJson(value) : value;
  if (!Array.isArray(parsed)) return null;

  const days = parsed.filter(
    (day): day is number =>
      typeof day === "number" && Number.isInteger(day) && day >= 0 && day <= 6
  );

  if (days.length !== parsed.length || days.length === 0) return null;
  return [...new Set(days)].sort((a, b) => a - b);
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function recurringPeopleMatch(
  first: RecurringPersonInput,
  second: RecurringPersonInput
) {
  if (first.patientId && second.patientId) {
    if (first.patientId === second.patientId) return true;
  }

  const a = normalizePersonFallback(first);
  const b = normalizePersonFallback(second);
  if (!a.name || !a.address || !a.city || !a.postalCode) return false;
  if (a.name !== b.name) return false;
  if (a.address !== b.address || a.city !== b.city || a.postalCode !== b.postalCode) {
    return false;
  }

  return !a.phone || !b.phone || a.phone === b.phone;
}

export function overlappingRecurringDays(first: number[], second: number[]) {
  const secondSet = new Set(second);
  return first.filter((day) => secondSet.has(day));
}

export function formatRecurringDayList(days: number[]) {
  return days.map((day) => RECURRING_DAY_NAMES[day] ?? `Day ${day}`).join(", ");
}

export function formatRecurringDuplicateMessage(
  input: Pick<RecurringDuplicateInput, "patientName">,
  match: RecurringDuplicateMatch
) {
  const days = formatRecurringDayList(match.overlappingDays);
  return `${input.patientName} already has an active recurring profile on ${days}.`;
}

export async function findRecurringDuplicate(
  client: RecurringDuplicateClient,
  input: RecurringDuplicateInput,
  options: { excludeId?: string } = {}
): Promise<RecurringDuplicateMatch | null> {
  const activeDays = parseRecurringActiveDays(input.activeDays);
  if (!activeDays) return null;

  const recurringOrders = (await client.recurringOrder.findMany({
    where: {
      storeId: input.storeId,
      isActive: true,
      ...(options.excludeId ? { id: { not: options.excludeId } } : {}),
    },
    select: recurringDuplicateSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  })) as RecurringDuplicateRecord[];

  for (const recurringOrder of recurringOrders) {
    if (!recurringPeopleMatch(input, recurringOrder)) continue;

    const existingDays = parseRecurringActiveDays(recurringOrder.activeDays);
    if (!existingDays) continue;

    const overlappingDays = overlappingRecurringDays(activeDays, existingDays);
    if (overlappingDays.length > 0) {
      return { recurringOrder, overlappingDays };
    }
  }

  return null;
}

export function buildRecurringDuplicateCleanupPlan(
  recurringOrders: RecurringDuplicateRecord[]
) {
  const sorted = [...recurringOrders].sort((a, b) => {
    const storeCompare = a.storeId.localeCompare(b.storeId);
    if (storeCompare !== 0) return storeCompare;
    const createdCompare = a.createdAt.getTime() - b.createdAt.getTime();
    return createdCompare !== 0 ? createdCompare : a.id.localeCompare(b.id);
  });

  const claimsByStoreDay = new Map<string, RecurringDuplicateRecord[]>();
  const changes = new Map<string, RecurringDuplicateCleanupChange>();

  for (const order of sorted) {
    const activeDays = parseRecurringActiveDays(order.activeDays);
    if (!activeDays) continue;

    for (const day of activeDays) {
      const claimKey = `${order.storeId}:${day}`;
      const claims = claimsByStoreDay.get(claimKey) ?? [];
      const keeper = claims.find((claim) => recurringPeopleMatch(claim, order));

      if (!keeper) {
        claims.push(order);
        claimsByStoreDay.set(claimKey, claims);
        continue;
      }

      const change =
        changes.get(order.id) ??
        ({
          order,
          duplicateDays: [],
          remainingDays: activeDays,
          keptBy: [],
        } satisfies RecurringDuplicateCleanupChange);

      if (!change.duplicateDays.includes(day)) {
        change.duplicateDays.push(day);
        change.remainingDays = activeDays.filter(
          (activeDay) => !change.duplicateDays.includes(activeDay)
        );
        change.keptBy.push({
          day,
          recurringOrderId: keeper.id,
          patientId: keeper.patientId,
          patientName: keeper.patientName,
          deliveryAddress: keeper.deliveryAddress,
          deliveryCity: keeper.deliveryCity,
          deliveryPostalCode: keeper.deliveryPostalCode,
        });
      }

      changes.set(order.id, change);
    }
  }

  return [...changes.values()].map((change) => ({
    ...change,
    duplicateDays: [...change.duplicateDays].sort((a, b) => a - b),
    remainingDays: [...change.remainingDays].sort((a, b) => a - b),
  }));
}
