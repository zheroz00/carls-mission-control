import { appendActivityEvent } from "@/lib/activity-store";
import { writeJsonFile } from "@/lib/data";
import { asString, asStringArray, toIso, uniqueStrings } from "@/lib/model-utils";
import { normalizeProject, readProjects } from "@/lib/project-store";
import { ProjectStatus } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const projects = await readProjects();
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  return NextResponse.json({ project });
}

function normalizeStatus(value: unknown, fallback: ProjectStatus): ProjectStatus {
  if (value === "active" || value === "paused" || value === "completed") {
    return value;
  }
  return fallback;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }

  const projects = await readProjects();
  const index = projects.findIndex((project) => project.id === id);

  if (index < 0) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const current = projects[index];
  const patched = normalizeProject({
    ...current,
    name: asString(body.name, current.name),
    objective: asString(body.objective, current.objective),
    status: normalizeStatus(body.status, current.status),
    ownerId: asString(body.ownerId, current.ownerId),
    linkedTaskIds:
      body.linkedTaskIds !== undefined
        ? uniqueStrings(asStringArray(body.linkedTaskIds))
        : current.linkedTaskIds,
    linkedDocIds:
      body.linkedDocIds !== undefined
        ? uniqueStrings(asStringArray(body.linkedDocIds))
        : current.linkedDocIds,
    linkedMemoryIds:
      body.linkedMemoryIds !== undefined
        ? uniqueStrings(asStringArray(body.linkedMemoryIds))
        : current.linkedMemoryIds,
    updatedAt: toIso(body.updatedAt),
  });

  if (!patched) {
    return NextResponse.json({ error: "Invalid project patch payload." }, { status: 400 });
  }

  const nextProjects = [...projects];
  nextProjects[index] = patched;
  await writeJsonFile("projects.json", nextProjects);
  await appendActivityEvent({
    actorId: patched.ownerId || "main",
    kind: "system",
    message: `Updated project "${patched.name}"`,
    metadata: { projectId: patched.id, status: patched.status },
    source: "local",
  });

  return NextResponse.json({ project: patched });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const projects = await readProjects();
  const current = projects.find((project) => project.id === id);
  if (!current) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const nextProjects = projects.filter((project) => project.id !== id);
  await writeJsonFile("projects.json", nextProjects);
  await appendActivityEvent({
    actorId: current.ownerId || "main",
    kind: "system",
    message: `Deleted project "${current.name}"`,
    metadata: { projectId: current.id },
    source: "local",
  });

  return NextResponse.json({ success: true });
}

