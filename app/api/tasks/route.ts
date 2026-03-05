import { appendActivityEvent } from "@/lib/activity-store";
import { writeJsonFile } from "@/lib/data";
import { asString, makeId, toIso } from "@/lib/model-utils";
import { normalizeTask, readTasks } from "@/lib/task-store";
import { Task, TaskColumn } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isTaskColumn(value: unknown): value is TaskColumn {
  return ["todo", "in_progress", "review", "done"].includes(asString(value));
}

function sanitizeTaskInput(
  body: Record<string, unknown>,
  existing?: Task,
): Task | null {
  const now = new Date().toISOString();
  const id = existing?.id ?? asString(body.id, makeId("task"));
  const title = asString(body.title, existing?.title ?? "");
  const columnRaw = body.column ?? existing?.column ?? "todo";

  if (!title || !isTaskColumn(columnRaw)) {
    return null;
  }

  const task = normalizeTask({
    id,
    title,
    description: body.description ?? existing?.description ?? "",
    column: columnRaw,
    priority: body.priority ?? existing?.priority ?? "medium",
    assigneeId: body.assigneeId ?? existing?.assigneeId ?? "main",
    projectId:
      body.projectId === null
        ? null
        : body.projectId ?? existing?.projectId ?? null,
    createdAt: existing?.createdAt ?? toIso(body.createdAt, now),
    updatedAt: now,
    source: "local",
  });

  return task;
}

export async function GET() {
  const tasks = await readTasks();
  return NextResponse.json({ tasks });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid task payload." }, { status: 400 });
  }

  const tasks = await readTasks();
  const created = sanitizeTaskInput(body);
  if (!created) {
    return NextResponse.json(
      { error: "Invalid task payload. Expected title and valid column." },
      { status: 400 },
    );
  }

  const updated = [created, ...tasks];
  await writeJsonFile("tasks.json", updated);
  await appendActivityEvent({
    actorId: created.assigneeId || "main",
    kind: "task",
    message: `Created task "${created.title}"`,
    metadata: { taskId: created.id, column: created.column },
    source: "local",
  });

  return NextResponse.json({ task: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { tasks?: unknown[] }
    | null;

  if (!body || !Array.isArray(body.tasks)) {
    return NextResponse.json(
      { error: "Invalid payload. Expected { tasks: Task[] }." },
      { status: 400 },
    );
  }

  const normalized = body.tasks
    .map((task) => normalizeTask(task))
    .filter((task): task is Task => Boolean(task))
    .map((task) => ({ ...task, source: "local", updatedAt: toIso(task.updatedAt) }));

  await writeJsonFile("tasks.json", normalized);
  await appendActivityEvent({
    actorId: "main",
    kind: "task",
    message: `Bulk updated ${normalized.length} tasks`,
    source: "local",
  });

  return NextResponse.json({ tasks: normalized });
}

