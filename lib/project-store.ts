import { readJsonFile } from "@/lib/data";
import {
  asString,
  asStringArray,
  makeId,
  toIso,
  uniqueStrings,
} from "@/lib/model-utils";
import { Project, ProjectStatus } from "@/lib/types";

export const DEFAULT_PROJECTS: Project[] = [];

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

