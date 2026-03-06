import { readJsonFile, writeJsonFile } from "@/lib/data";
import { asString, makeId, toIso } from "@/lib/model-utils";
import { ActivityEvent, ActivityKind } from "@/lib/types";
import { publishActivity } from "@/lib/activity-bus";

const VALID_KINDS: ActivityKind[] = ["task", "cron", "memory", "docs", "system"];

const DEFAULT_ACTIVITY_EVENTS: ActivityEvent[] = [];

function normalizeKind(value: unknown): ActivityKind {
  const kind = asString(value);
  if ((VALID_KINDS as string[]).includes(kind)) {
    return kind as ActivityKind;
  }
  return "system";
}

function normalizeMetadata(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const input = value as Record<string, unknown>;
  const output: Record<string, string> = {};

  for (const [key, rawValue] of Object.entries(input)) {
    const normalized = asString(rawValue);
    if (normalized.length > 0) {
      output[key] = normalized;
    }
  }

  return Object.keys(output).length > 0 ? output : undefined;
}

export function normalizeActivityEvent(input: unknown): ActivityEvent | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const id = asString(raw.id);
  const actorId = asString(raw.actorId);
  const message = asString(raw.message);

  if (!id || !actorId || !message) {
    return null;
  }

  const source = asString(raw.source) === "gateway" ? "gateway" : "local";

  return {
    id,
    ts: toIso(raw.ts, new Date().toISOString()),
    actorId,
    kind: normalizeKind(raw.kind),
    message,
    metadata: normalizeMetadata(raw.metadata),
    source,
  };
}

export async function readActivityEvents(): Promise<ActivityEvent[]> {
  const raw = await readJsonFile<unknown[]>(
    "activity-events.json",
    DEFAULT_ACTIVITY_EVENTS,
  );
  return raw
    .map((item) => normalizeActivityEvent(item))
    .filter((item): item is ActivityEvent => Boolean(item))
    .sort((a, b) => b.ts.localeCompare(a.ts));
}

export async function appendActivityEvent(
  input: Omit<ActivityEvent, "id" | "ts"> & { id?: string; ts?: string },
): Promise<ActivityEvent> {
  const events = await readActivityEvents();

  const event: ActivityEvent = {
    id: input.id ?? makeId("evt"),
    ts: input.ts ?? new Date().toISOString(),
    actorId: input.actorId,
    kind: input.kind,
    message: input.message,
    metadata: input.metadata,
    source: input.source,
  };

  const updated = [event, ...events].slice(0, 400);
  await writeJsonFile("activity-events.json", updated);
  publishActivity(event);
  return event;
}
