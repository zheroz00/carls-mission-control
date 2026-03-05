import { readJsonFile } from "@/lib/data";
import { asString } from "@/lib/model-utils";
import { OfficeLayout, OfficePresence, TeamMember } from "@/lib/types";

const DEFAULT_LAYOUT: OfficeLayout = {
  width: 6,
  height: 4,
  seats: [
    { agentId: "main", x: 1, y: 1 },
    { agentId: "cog", x: 3, y: 1 },
    { agentId: "albert", x: 5, y: 1 },
  ],
};

export async function readOfficeLayout(): Promise<OfficeLayout> {
  const raw = await readJsonFile<OfficeLayout>("office-layout.json", DEFAULT_LAYOUT);

  const width =
    typeof raw.width === "number" && Number.isFinite(raw.width) && raw.width > 0
      ? Math.round(raw.width)
      : DEFAULT_LAYOUT.width;
  const height =
    typeof raw.height === "number" && Number.isFinite(raw.height) && raw.height > 0
      ? Math.round(raw.height)
      : DEFAULT_LAYOUT.height;

  const seats = Array.isArray(raw.seats)
    ? raw.seats
        .map((seat) => {
          if (!seat || typeof seat !== "object") {
            return null;
          }

          const rawSeat = seat as unknown as {
            agentId?: unknown;
            x?: unknown;
            y?: unknown;
          };
          const agentId = asString(rawSeat.agentId);
          const x = Number(rawSeat.x);
          const y = Number(rawSeat.y);

          if (!agentId || !Number.isFinite(x) || !Number.isFinite(y)) {
            return null;
          }

          return {
            agentId,
            x: Math.max(1, Math.floor(x)),
            y: Math.max(1, Math.floor(y)),
          };
        })
        .filter((seat): seat is { agentId: string; x: number; y: number } => Boolean(seat))
    : DEFAULT_LAYOUT.seats;

  return { width, height, seats };
}

export function derivePresence(params: {
  team: TeamMember[];
  activeTaskByAssignee: Map<string, string>;
  recentTaskByAssignee: Map<string, string>;
}): OfficePresence[] {
  const now = new Date().toISOString();

  return params.team.map((member) => {
    const activeTaskId = params.activeTaskByAssignee.get(member.id);
    const reviewTaskId = params.recentTaskByAssignee.get(member.id);

    if (activeTaskId) {
      return {
        agentId: member.id,
        zone: "desk",
        status: "active",
        taskId: activeTaskId,
        updatedAt: now,
      } satisfies OfficePresence;
    }

    if (reviewTaskId) {
      return {
        agentId: member.id,
        zone: "review",
        status: "idle",
        taskId: reviewTaskId,
        updatedAt: now,
      } satisfies OfficePresence;
    }

    return {
      agentId: member.id,
      zone: member.level === "main" ? "meeting" : "idle",
      status: "idle",
      updatedAt: now,
    } satisfies OfficePresence;
  });
}
