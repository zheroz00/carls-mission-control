import {
  appendActivityEvent,
  normalizeActivityEvent,
  readActivityEvents,
} from "@/lib/activity-store";
import { fetchGatewayCollection } from "@/lib/gateway";
import { asString } from "@/lib/model-utils";
import { ActivityEvent, ActivityKind } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeGatewayActivity(input: unknown): ActivityEvent | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const text = asString(raw.message || raw.text || raw.summary);
  if (!text) {
    return null;
  }

  const kindRaw = asString(raw.kind || raw.type || "system");
  const kind: ActivityKind =
    kindRaw === "task" ||
    kindRaw === "cron" ||
    kindRaw === "memory" ||
    kindRaw === "docs"
      ? kindRaw
      : "system";

  return normalizeActivityEvent({
    id: asString(raw.id, `gateway-${Date.now().toString(36)}`),
    ts: raw.ts ?? raw.timestamp ?? raw.createdAt ?? new Date().toISOString(),
    actorId: asString(raw.actorId || raw.actor || raw.agentId || "gateway"),
    kind,
    message: text,
    metadata:
      raw.metadata && typeof raw.metadata === "object"
        ? (raw.metadata as Record<string, string>)
        : undefined,
    source: "gateway",
  });
}

function dedupeEvents(events: ActivityEvent[]): ActivityEvent[] {
  const seen = new Set<string>();
  const deduped: ActivityEvent[] = [];

  for (const event of events.sort((a, b) => b.ts.localeCompare(a.ts))) {
    if (seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    deduped.push(event);
  }

  return deduped;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const limit = Math.min(
    300,
    Math.max(1, Number(searchParams.get("limit") ?? "120") || 120),
  );

  const [localEvents, gatewayEventsResult] = await Promise.all([
    readActivityEvents(),
    fetchGatewayCollection<unknown>([
      "/api/events",
      "/api/activity",
      "/events",
      "/activity",
      "/api/debug/events",
      "/api/debug/logs",
    ]),
  ]);

  const gatewayEvents = gatewayEventsResult.items
    .map((item) => normalizeGatewayActivity(item))
    .filter((item): item is ActivityEvent => Boolean(item));

  const events = dedupeEvents([...localEvents, ...gatewayEvents]).slice(0, limit);

  return NextResponse.json({
    events,
    gatewayConnected: gatewayEventsResult.connected,
    gatewayEndpoint: gatewayEventsResult.endpoint,
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid activity payload." }, { status: 400 });
  }

  const actorId = asString(body.actorId, "main");
  const kindRaw = asString(body.kind, "system");
  const kind: ActivityKind =
    kindRaw === "task" ||
    kindRaw === "cron" ||
    kindRaw === "memory" ||
    kindRaw === "docs" ||
    kindRaw === "system"
      ? kindRaw
      : "system";
  const message = asString(body.message);

  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }

  const event = await appendActivityEvent({
    actorId,
    kind,
    message,
    metadata:
      body.metadata && typeof body.metadata === "object"
        ? (body.metadata as Record<string, string>)
        : undefined,
    source: "local",
  });

  return NextResponse.json({ event }, { status: 201 });
}

