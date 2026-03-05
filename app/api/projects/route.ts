import { appendActivityEvent } from "@/lib/activity-store";
import { writeJsonFile } from "@/lib/data";
import { asString } from "@/lib/model-utils";
import { makeProject, normalizeProject, readProjects } from "@/lib/project-store";
import { Project } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await readProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid project payload." }, { status: 400 });
  }

  const name = asString(body.name);
  if (!name) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const projects = await readProjects();
  const created = makeProject({
    name,
    objective: asString(body.objective),
    status:
      body.status === "active" || body.status === "paused" || body.status === "completed"
        ? body.status
        : "active",
    ownerId: asString(body.ownerId, "main"),
  });

  const updated = [created, ...projects];
  await writeJsonFile("projects.json", updated);
  await appendActivityEvent({
    actorId: created.ownerId,
    kind: "system",
    message: `Created project "${created.name}"`,
    metadata: { projectId: created.id },
    source: "local",
  });

  return NextResponse.json({ project: created }, { status: 201 });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { projects?: unknown[] }
    | null;

  if (!body || !Array.isArray(body.projects)) {
    return NextResponse.json(
      { error: "Invalid payload. Expected { projects: Project[] }." },
      { status: 400 },
    );
  }

  const normalized = body.projects
    .map((project) => normalizeProject(project))
    .filter((project): project is Project => Boolean(project));

  await writeJsonFile("projects.json", normalized);
  await appendActivityEvent({
    actorId: "main",
    kind: "system",
    message: `Bulk updated ${normalized.length} projects`,
    source: "local",
  });

  return NextResponse.json({ projects: normalized });
}

