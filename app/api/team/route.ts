import {
  readMissionProfile,
  readTeamMembers,
  readTeamOverrides,
  writeMissionProfile,
  writeTeamOverrides,
} from "@/lib/openclaw";
import { asString, toIso } from "@/lib/model-utils";
import { TeamOverride } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mergeOverride(
  overrides: TeamOverride[],
  next: TeamOverride,
): TeamOverride[] {
  const index = overrides.findIndex((item) => item.id === next.id);
  if (index < 0) {
    return [...overrides, next];
  }

  const copy = [...overrides];
  copy[index] = {
    ...copy[index],
    ...next,
  };
  return copy;
}

export async function GET() {
  const [members, mission, overrides] = await Promise.all([
    readTeamMembers(),
    readMissionProfile(),
    readTeamOverrides(),
  ]);

  return NextResponse.json({
    members,
    mission,
    overrides,
  });
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid patch payload." }, { status: 400 });
  }

  let updatedMission = false;
  let updatedOverrides = false;

  if (body.mission && typeof body.mission === "object") {
    const raw = body.mission as Record<string, unknown>;
    const mission = await readMissionProfile();
    await writeMissionProfile({
      statement: asString(raw.statement, mission.statement),
      updatedAt: toIso(new Date().toISOString()),
      defaultOwnerId: asString(raw.defaultOwnerId, mission.defaultOwnerId),
    });
    updatedMission = true;
  }

  if (body.override && typeof body.override === "object") {
    const raw = body.override as Record<string, unknown>;
    const id = asString(raw.id);
    if (!id) {
      return NextResponse.json({ error: "override.id is required." }, { status: 400 });
    }

    const overrides = await readTeamOverrides();
    const merged = mergeOverride(overrides, {
      id,
      displayName: asString(raw.displayName) || undefined,
      role: asString(raw.role) || undefined,
      level:
        raw.level === "main" || raw.level === "subagent" || raw.level === "worker"
          ? raw.level
          : undefined,
      deviceLabel: asString(raw.deviceLabel) || undefined,
    });
    await writeTeamOverrides(merged);
    updatedOverrides = true;
  }

  if (!updatedMission && !updatedOverrides) {
    return NextResponse.json(
      { error: "Nothing to update. Use mission and/or override payload." },
      { status: 400 },
    );
  }

  const [members, mission, overrides] = await Promise.all([
    readTeamMembers(),
    readMissionProfile(),
    readTeamOverrides(),
  ]);

  return NextResponse.json({
    members,
    mission,
    overrides,
  });
}

