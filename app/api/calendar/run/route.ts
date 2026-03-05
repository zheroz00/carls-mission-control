import { appendActivityEvent } from "@/lib/activity-store";
import { readJsonFile, writeJsonFile } from "@/lib/data";
import { CronJob, ProactiveTask } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CalendarRunRequest {
  kind?: "cron" | "proactive";
  id?: string;
  source?: "local" | "gateway";
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CalendarRunRequest | null;
  if (!body?.kind || !body.id) {
    return NextResponse.json(
      { error: "Invalid payload. Expected kind and id." },
      { status: 400 },
    );
  }

  if (body.source === "gateway") {
    return NextResponse.json(
      { error: "Gateway run actions are not enabled in this phase." },
      { status: 400 },
    );
  }

  if (body.kind === "cron") {
    const cronJobs = await readJsonFile<CronJob[]>("cron-jobs.json", []);
    const job = cronJobs.find((item) => item.id === body.id);
    if (!job) {
      return NextResponse.json({ error: "Cron job not found." }, { status: 404 });
    }

    const event = await appendActivityEvent({
      actorId: "main",
      kind: "cron",
      message: `Ran cron job "${job.name}" from Calendar.`,
      metadata: { cronId: job.id, schedule: job.schedule },
      source: "local",
    });

    return NextResponse.json({ ok: true, kind: body.kind, id: body.id, event });
  }

  const proactiveTasks = await readJsonFile<ProactiveTask[]>("proactive-tasks.json", []);
  const index = proactiveTasks.findIndex((item) => item.id === body.id);
  if (index < 0) {
    return NextResponse.json({ error: "Proactive task not found." }, { status: 404 });
  }

  const now = new Date().toISOString();
  const current = proactiveTasks[index];
  const updatedTask: ProactiveTask = {
    ...current,
    status: "active",
    dueAt: now,
    source: "local",
  };

  const updated = [...proactiveTasks];
  updated[index] = updatedTask;
  await writeJsonFile("proactive-tasks.json", updated);

  const event = await appendActivityEvent({
    actorId: "main",
    kind: "cron",
    message: `Ran proactive task "${updatedTask.title}" from Calendar.`,
    metadata: { proactiveId: updatedTask.id },
    source: "local",
  });

  return NextResponse.json({
    ok: true,
    kind: body.kind,
    id: body.id,
    proactiveTask: updatedTask,
    event,
  });
}

