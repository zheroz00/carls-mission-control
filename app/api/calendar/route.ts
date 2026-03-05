import { readJsonFile } from "@/lib/data";
import { fetchGatewayCollection, fetchGatewayStatus } from "@/lib/gateway";
import { CalendarPayload, CronJob, ProactiveTask } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_CRON_JOBS: CronJob[] = [
  {
    id: "cron-memory-rollup",
    name: "Memory Rollup",
    schedule: "0 */2 * * *",
    nextRun: "2026-03-03T18:00:00.000Z",
    source: "local",
  },
  {
    id: "cron-doc-index",
    name: "Docs Index Rebuild",
    schedule: "15 * * * *",
    nextRun: "2026-03-03T17:15:00.000Z",
    source: "local",
  },
  {
    id: "cron-signal-scan",
    name: "Signal Drift Scan",
    schedule: "30 6 * * *",
    nextRun: "2026-03-04T06:30:00.000Z",
    source: "local",
  },
];

const DEFAULT_PROACTIVE_TASKS: ProactiveTask[] = [
  {
    id: "proactive-standup-brief",
    title: "Generate standup brief",
    dueAt: "2026-03-04T13:00:00.000Z",
    status: "queued",
    source: "local",
  },
  {
    id: "proactive-memory-gap",
    title: "Backfill missing memory windows",
    dueAt: "2026-03-05T10:00:00.000Z",
    status: "active",
    source: "local",
  },
];

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
}

function normalizeCronJob(item: unknown, source: "local" | "gateway"): CronJob | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const name = asString(raw.name ?? raw.title ?? raw.job, "Gateway Job");
  const schedule = asString(raw.schedule ?? raw.cron ?? raw.expression, "unknown");
  const nextRun = asString(
    raw.nextRun ?? raw.next_run ?? raw.runAt ?? raw.nextExecution,
    new Date().toISOString(),
  );
  const id = asString(raw.id, `${source}-${name}-${schedule}`.toLowerCase().replace(/\s+/g, "-"));

  const color = typeof raw.color === "string" ? raw.color : undefined;
  return { id, name, schedule, nextRun, source, ...(color ? { color } : {}) };
}

function normalizeProactiveTask(
  item: unknown,
  source: "local" | "gateway",
): ProactiveTask | null {
  if (!item || typeof item !== "object") {
    return null;
  }

  const raw = item as Record<string, unknown>;
  const title = asString(raw.title ?? raw.name ?? raw.task, "Gateway Task");
  const dueAt = asString(raw.dueAt ?? raw.due_at ?? raw.runAt, new Date().toISOString());
  const status = asString(raw.status, "queued");
  const id = asString(raw.id, `${source}-${title}-${dueAt}`.toLowerCase().replace(/\s+/g, "-"));

  return {
    id,
    title,
    dueAt,
    status: ["queued", "active", "done"].includes(status) ? (status as ProactiveTask["status"]) : "queued",
    source,
  };
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

export async function GET() {
  const [localCronJobs, localProactiveTasks, gatewayStatus, gatewayCronResult, gatewayProactiveResult] =
    await Promise.all([
      readJsonFile<CronJob[]>("cron-jobs.json", DEFAULT_CRON_JOBS),
      readJsonFile<ProactiveTask[]>("proactive-tasks.json", DEFAULT_PROACTIVE_TASKS),
      fetchGatewayStatus(),
      fetchGatewayCollection<unknown>([
        "/api/cron",
        "/api/cron/jobs",
        "/cron/jobs",
        "/jobs/cron",
      ]),
      fetchGatewayCollection<unknown>([
        "/api/proactive",
        "/api/tasks/proactive",
        "/proactive/tasks",
        "/tasks/proactive",
      ]),
    ]);

  const gatewayCronJobs = gatewayCronResult.items
    .map((item) => normalizeCronJob(item, "gateway"))
    .filter((item): item is CronJob => Boolean(item));

  const gatewayProactiveTasks = gatewayProactiveResult.items
    .map((item) => normalizeProactiveTask(item, "gateway"))
    .filter((item): item is ProactiveTask => Boolean(item));

  const cronJobs = dedupeById(
    [...localCronJobs.map((item) => normalizeCronJob(item, "local")), ...gatewayCronJobs].filter(
      (item): item is CronJob => Boolean(item),
    ),
  ).sort((a, b) => a.nextRun.localeCompare(b.nextRun));

  const proactiveTasks = dedupeById(
    [...localProactiveTasks.map((item) => normalizeProactiveTask(item, "local")), ...gatewayProactiveTasks].filter(
      (item): item is ProactiveTask => Boolean(item),
    ),
  ).sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const payload: CalendarPayload = {
    cronJobs,
    proactiveTasks,
    gatewayConnected:
      gatewayStatus.connected || gatewayCronResult.connected || gatewayProactiveResult.connected,
    gatewayEndpoint: gatewayCronResult.endpoint ?? gatewayProactiveResult.endpoint,
  };

  return NextResponse.json(payload);
}
