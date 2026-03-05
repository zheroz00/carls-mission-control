import { appendActivityEvent } from "@/lib/activity-store";
import { writeJsonFile } from "@/lib/data";
import { asString, toIso } from "@/lib/model-utils";
import { normalizeTask, readTasks } from "@/lib/task-store";
import { Task } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const tasks = await readTasks();
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  return NextResponse.json({ task });
}

function sanitizePatch(input: Record<string, unknown>, existing: Task): Task | null {
  const next = normalizeTask({
    ...existing,
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    source: "local",
  });

  return next;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }

  const tasks = await readTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const current = tasks[index];
  const updated = sanitizePatch(body, current);

  if (!updated) {
    return NextResponse.json({ error: "Invalid task patch payload." }, { status: 400 });
  }

  const nextTasks = [...tasks];
  nextTasks[index] = {
    ...updated,
    updatedAt: toIso(updated.updatedAt),
  };
  await writeJsonFile("tasks.json", nextTasks);

  const patchSummary = Object.keys(body).slice(0, 4).join(", ") || "fields";
  await appendActivityEvent({
    actorId: asString(updated.assigneeId, "main"),
    kind: "task",
    message: `Updated task "${updated.title}" (${patchSummary})`,
    metadata: { taskId: updated.id, column: updated.column },
    source: "local",
  });

  return NextResponse.json({ task: nextTasks[index] });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const tasks = await readTasks();
  const current = tasks.find((task) => task.id === id);

  if (!current) {
    return NextResponse.json({ error: "Task not found." }, { status: 404 });
  }

  const nextTasks = tasks.filter((task) => task.id !== id);
  await writeJsonFile("tasks.json", nextTasks);
  await appendActivityEvent({
    actorId: asString(current.assigneeId, "main"),
    kind: "task",
    message: `Deleted task "${current.title}"`,
    metadata: { taskId: current.id },
    source: "local",
  });

  return NextResponse.json({ success: true });
}

