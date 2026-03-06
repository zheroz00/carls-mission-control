import { readJsonFile } from "@/lib/data";
import { asString, toIso } from "@/lib/model-utils";
import { Task, TaskColumn, TaskPriority, TaskSource } from "@/lib/types";

export const DEFAULT_TASKS: Task[] = [];

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

