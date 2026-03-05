import { readActivityEvents } from "@/lib/activity-store";
import { readOfficeLayout, derivePresence } from "@/lib/office-store";
import { readTeamMembers } from "@/lib/openclaw";
import { readTasks } from "@/lib/task-store";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [layout, team, tasks, events] = await Promise.all([
    readOfficeLayout(),
    readTeamMembers(),
    readTasks(),
    readActivityEvents(),
  ]);

  const activeTaskByAssignee = new Map<string, string>();
  const recentTaskByAssignee = new Map<string, string>();

  for (const task of tasks) {
    if (!task.assigneeId) {
      continue;
    }
    if (task.column === "in_progress" && !activeTaskByAssignee.has(task.assigneeId)) {
      activeTaskByAssignee.set(task.assigneeId, task.id);
      continue;
    }
    if (
      (task.column === "review" || task.column === "done") &&
      !recentTaskByAssignee.has(task.assigneeId)
    ) {
      recentTaskByAssignee.set(task.assigneeId, task.id);
    }
  }

  const presence = derivePresence({
    team,
    activeTaskByAssignee,
    recentTaskByAssignee,
  });

  return NextResponse.json({
    layout,
    presence,
    recentEvents: events.slice(0, 24),
    updatedAt: new Date().toISOString(),
  });
}

