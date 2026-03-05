import { readJsonFile, writeJsonFile } from "@/lib/data";
import { asString, makeId, toIso } from "@/lib/model-utils";
import {
  MissionProfile,
  TeamMember,
  TeamMemberLevel,
  TeamOverride,
} from "@/lib/types";
import { readFile } from "node:fs/promises";

const OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH ?? "/home/hank/.openclaw/openclaw.json";

interface OpenClawAgentConfig {
  id?: string;
  model?: string;
  workspace?: string;
  default?: boolean;
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgentConfig[];
  };
}

export const DEFAULT_MISSION: MissionProfile = {
  statement:
    "Build and operate an observable autonomous AI workspace that delivers reliable daily value.",
  updatedAt: "2026-03-03T00:00:00.000Z",
  defaultOwnerId: "main",
};

export async function readMissionProfile(): Promise<MissionProfile> {
  const raw = await readJsonFile<MissionProfile>("mission.json", DEFAULT_MISSION);
  return {
    statement: asString(raw.statement, DEFAULT_MISSION.statement),
    updatedAt: toIso(raw.updatedAt, DEFAULT_MISSION.updatedAt),
    defaultOwnerId: asString(raw.defaultOwnerId, DEFAULT_MISSION.defaultOwnerId),
  };
}

export async function writeMissionProfile(mission: MissionProfile): Promise<void> {
  await writeJsonFile("mission.json", mission);
}

async function readOpenClawConfig(): Promise<OpenClawConfig | null> {
  try {
    const raw = await readFile(OPENCLAW_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as OpenClawConfig;
  } catch {
    return null;
  }
}

function inferLevel(agent: OpenClawAgentConfig): TeamMemberLevel {
  if (agent.default || asString(agent.id) === "main") {
    return "main";
  }

  return "subagent";
}

function deriveDisplayName(agent: OpenClawAgentConfig): string {
  const id = asString(agent.id, "agent");
  return id.slice(0, 1).toUpperCase() + id.slice(1);
}

function deriveRole(agent: OpenClawAgentConfig): string {
  if (agent.default || asString(agent.id) === "main") {
    return "Orchestrator";
  }
  return "Specialist";
}

export async function readTeamOverrides(): Promise<TeamOverride[]> {
  const raw = await readJsonFile<TeamOverride[]>("team-overrides.json", []);
  const overrides: TeamOverride[] = [];

  for (const item of raw) {
    const id = asString(item.id);
    if (!id) {
      continue;
    }

    overrides.push({
      id,
      displayName: asString(item.displayName) || undefined,
      role: asString(item.role) || undefined,
      level:
        item.level === "main" || item.level === "subagent" || item.level === "worker"
          ? item.level
          : undefined,
      deviceLabel: asString(item.deviceLabel) || undefined,
    });
  }

  return overrides;
}

export async function writeTeamOverrides(overrides: TeamOverride[]): Promise<void> {
  await writeJsonFile("team-overrides.json", overrides);
}

export async function readTeamMembers(): Promise<TeamMember[]> {
  const config = await readOpenClawConfig();
  const overrides = await readTeamOverrides();
  const overrideById = new Map(overrides.map((item) => [item.id, item]));

  const configuredAgents = config?.agents?.list ?? [];
  const resolved: TeamMember[] = [];

  for (const agent of configuredAgents) {
    const id = asString(agent.id);
    if (!id) {
      continue;
    }

    const override = overrideById.get(id);
    const member: TeamMember = {
      id,
      displayName: override?.displayName ?? deriveDisplayName(agent),
      role: override?.role ?? deriveRole(agent),
      model: asString(agent.model, "unknown"),
      workspace: asString(agent.workspace, "unknown"),
      level: override?.level ?? inferLevel(agent),
      source: override ? "localOverride" : "config",
    };

    if (override?.deviceLabel) {
      member.deviceLabel = override.deviceLabel;
    }

    resolved.push(member);
  }

  if (resolved.length > 0) {
    return resolved.sort((a, b) => a.id.localeCompare(b.id));
  }

  return [
    {
      id: "main",
      displayName: "Main",
      role: "Orchestrator",
      model: "unknown",
      workspace: "unknown",
      level: "main",
      source: "config",
    },
  ];
}

export function makeActivityEvent(input: {
  actorId: string;
  kind: "task" | "cron" | "memory" | "docs" | "system";
  message: string;
  metadata?: Record<string, string>;
  source?: "local" | "gateway";
}) {
  return {
    id: makeId("evt"),
    ts: new Date().toISOString(),
    actorId: input.actorId,
    kind: input.kind,
    message: input.message,
    metadata: input.metadata,
    source: input.source ?? "local",
  };
}
