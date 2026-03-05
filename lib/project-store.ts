import { readJsonFile } from "@/lib/data";
import {
  asString,
  asStringArray,
  makeId,
  toIso,
  uniqueStrings,
} from "@/lib/model-utils";
import { Project, ProjectStatus } from "@/lib/types";

export const DEFAULT_PROJECTS: Project[] = [
  {
    id: "project-mission-control-core",
    name: "Mission Control Core",
    objective:
      "Ship core board/calendar/memory/docs workflows with reliable local fallback.",
    status: "active",
    ownerId: "main",
    createdAt: "2026-03-01T08:00:00.000Z",
    updatedAt: "2026-03-02T18:30:00.000Z",
    linkedTaskIds: ["task-1", "task-2", "task-4"],
    linkedDocIds: ["doc-ops-runbook"],
    linkedMemoryIds: [],
  },
  {
    id: "project-autonomy-expansion",
    name: "Autonomy Expansion",
    objective:
      "Improve observability and readiness for future autonomous workflows.",
    status: "paused",
    ownerId: "cog",
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-02T11:00:00.000Z",
    linkedTaskIds: ["task-3"],
    linkedDocIds: ["doc-proactive-guidelines"],
    linkedMemoryIds: [],
  },
];

const VALID_PROJECT_STATUS: ProjectStatus[] = ["active", "paused", "completed"];

function normalizeStatus(value: unknown): ProjectStatus {
  const candidate = asString(value);
  if ((VALID_PROJECT_STATUS as string[]).includes(candidate)) {
    return candidate as ProjectStatus;
  }
  return "active";
}

export function normalizeProject(input: unknown): Project | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const id = asString(raw.id);
  const name = asString(raw.name);

  if (!id || !name) {
    return null;
  }

  const createdAt = toIso(raw.createdAt, new Date().toISOString());

  return {
    id,
    name,
    objective: asString(raw.objective),
    status: normalizeStatus(raw.status),
    ownerId: asString(raw.ownerId, "main"),
    createdAt,
    updatedAt: toIso(raw.updatedAt, createdAt),
    linkedTaskIds: uniqueStrings(asStringArray(raw.linkedTaskIds)),
    linkedDocIds: uniqueStrings(asStringArray(raw.linkedDocIds)),
    linkedMemoryIds: uniqueStrings(asStringArray(raw.linkedMemoryIds)),
  };
}

export async function readProjects(): Promise<Project[]> {
  const raw = await readJsonFile<unknown[]>("projects.json", DEFAULT_PROJECTS);
  return raw
    .map((item) => normalizeProject(item))
    .filter((item): item is Project => Boolean(item));
}

export function makeProject(input: {
  name: string;
  objective?: string;
  status?: ProjectStatus;
  ownerId?: string;
}): Project {
  const now = new Date().toISOString();
  return {
    id: makeId("project"),
    name: input.name,
    objective: input.objective ?? "",
    status: input.status ?? "active",
    ownerId: input.ownerId ?? "main",
    createdAt: now,
    updatedAt: now,
    linkedTaskIds: [],
    linkedDocIds: [],
    linkedMemoryIds: [],
  };
}

