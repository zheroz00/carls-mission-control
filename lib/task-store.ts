import { readJsonFile } from "@/lib/data";
import { asString, toIso } from "@/lib/model-utils";
import { Task, TaskColumn, TaskPriority, TaskSource } from "@/lib/types";

export const DEFAULT_TASKS: Task[] = [
  {
    id: "task-1",
    title: "Audit OpenClaw heartbeat checks",
    description: "Verify signal quality and retry behavior for gateway pings.",
    column: "todo",
    priority: "high",
    assigneeId: "main",
    projectId: null,
    createdAt: "2026-03-01T09:15:00.000Z",
    updatedAt: "2026-03-01T09:15:00.000Z",
    source: "local",
  },
  {
    id: "task-2",
    title: "Summarize overnight proactive alerts",
    description: "Roll up auto-generated follow-ups before standup.",
    column: "in_progress",
    priority: "medium",
    assigneeId: "main",
    projectId: null,
    createdAt: "2026-03-01T11:10:00.000Z",
    updatedAt: "2026-03-02T08:45:00.000Z",
    source: "local",
  },
  {
    id: "task-3",
    title: "Review memory ingestion anomalies",
    description: "Cross-check duplicate entries from yesterday's run.",
    column: "review",
    priority: "medium",
    assigneeId: "cog",
    projectId: null,
    createdAt: "2026-03-02T07:20:00.000Z",
    updatedAt: "2026-03-02T14:05:00.000Z",
    source: "local",
  },
  {
    id: "task-4",
    title: "Publish docs index refresh",
    description: "Push searchable docs manifest for Carl-generated artifacts.",
    column: "done",
    priority: "low",
    assigneeId: "albert",
    projectId: null,
    createdAt: "2026-03-01T14:00:00.000Z",
    updatedAt: "2026-03-02T16:30:00.000Z",
    source: "local",
  },
];

const VALID_COLUMNS: TaskColumn[] = ["todo", "in_progress", "review", "done"];
const VALID_PRIORITIES: TaskPriority[] = ["low", "medium", "high"];

function normalizeTaskColumn(value: unknown): TaskColumn {
  const candidate = asString(value);
  if ((VALID_COLUMNS as string[]).includes(candidate)) {
    return candidate as TaskColumn;
  }
  return "todo";
}

function normalizeTaskPriority(value: unknown): TaskPriority {
  const candidate = asString(value);
  if ((VALID_PRIORITIES as string[]).includes(candidate)) {
    return candidate as TaskPriority;
  }
  return "medium";
}

function normalizeSource(value: unknown): TaskSource {
  return asString(value) === "gateway" ? "gateway" : "local";
}

export function normalizeTask(input: unknown): Task | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const id = asString(raw.id);
  const title = asString(raw.title);

  if (!id || !title) {
    return null;
  }

  const createdAt = toIso(raw.createdAt, new Date().toISOString());
  const updatedAt = toIso(raw.updatedAt, createdAt);
  const projectId = asString(raw.projectId);

  return {
    id,
    title,
    description: asString(raw.description),
    column: normalizeTaskColumn(raw.column),
    priority: normalizeTaskPriority(raw.priority),
    assigneeId: asString(raw.assigneeId, "main"),
    projectId: projectId.length > 0 ? projectId : null,
    createdAt,
    updatedAt,
    source: normalizeSource(raw.source),
  };
}

export async function readTasks(): Promise<Task[]> {
  const tasksRaw = await readJsonFile<unknown[]>("tasks.json", DEFAULT_TASKS);

  return tasksRaw
    .map((item) => normalizeTask(item))
    .filter((item): item is Task => Boolean(item));
}

