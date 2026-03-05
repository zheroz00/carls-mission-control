"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MissionProfile, TeamMember, TeamMemberLevel } from "@/lib/types";

interface TeamPayload {
  members: TeamMember[];
  mission: MissionProfile;
}

const LEVEL_LABELS: Record<TeamMemberLevel, string> = {
  main: "Main Agent",
  subagent: "Sub Agent",
  worker: "Worker",
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [mission, setMission] = useState<MissionProfile | null>(null);
  const [missionDraft, setMissionDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchTeam() {
    try {
      const response = await fetch("/api/team");
      const payload = (await response.json()) as TeamPayload;
      setMembers(payload.members ?? []);
      setMission(payload.mission);
      setMissionDraft(payload.mission?.statement ?? "");
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load team data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchTeam();
  }, []);

  const grouped = useMemo(() => {
    const byLevel = new Map<TeamMemberLevel, TeamMember[]>([
      ["main", []],
      ["subagent", []],
      ["worker", []],
    ]);

    for (const member of members) {
      byLevel.get(member.level)?.push(member);
    }

    return byLevel;
  }, [members]);

  async function updateMission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch("/api/team", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mission: {
            statement: missionDraft,
            defaultOwnerId: mission?.defaultOwnerId ?? "main",
          },
        }),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchTeam();
    } catch {
      setError("Unable to update mission statement.");
    }
  }

  async function updateOverride(input: {
    id: string;
    displayName?: string;
    role?: string;
    deviceLabel?: string;
    level?: TeamMemberLevel;
  }) {
    try {
      const response = await fetch("/api/team", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ override: input }),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchTeam();
    } catch {
      setError(`Unable to update ${input.id}.`);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Team</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Mission + Agent Hierarchy
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Team data is sourced from OpenClaw config with local override controls.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
          Mission Statement
        </h2>
        <form onSubmit={updateMission} className="mt-3 space-y-3">
          <textarea
            value={missionDraft}
            onChange={(event) => setMissionDraft(event.target.value)}
            rows={3}
            className="w-full rounded-xl border border-white/10 bg-panel-strong/75 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <button
            type="submit"
            className="rounded-xl border border-sky-300/30 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/25"
          >
            Save Mission
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {loading ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
          Loading team...
        </div>
      ) : (
        <section className="space-y-4">
          {(["main", "subagent", "worker"] as TeamMemberLevel[]).map((level) => (
            <article key={level} className="rounded-2xl border border-white/10 bg-panel/80 p-4">
              <header className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
                  {LEVEL_LABELS[level]}
                </h2>
                <span className="text-xs text-slate-500">{grouped.get(level)?.length ?? 0}</span>
              </header>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {(grouped.get(level) ?? []).map((member) => (
                  <TeamMemberCard
                    key={`${member.id}-${member.displayName}-${member.role}-${member.deviceLabel ?? ""}`}
                    member={member}
                    onSave={(override) =>
                      updateOverride({
                        id: member.id,
                        level,
                        ...override,
                      })
                    }
                  />
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function TeamMemberCard({
  member,
  onSave,
}: {
  member: TeamMember;
  onSave: (input: { displayName?: string; role?: string; deviceLabel?: string }) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(member.displayName);
  const [role, setRole] = useState(member.role);
  const [deviceLabel, setDeviceLabel] = useState(member.deviceLabel ?? "");

  return (
    <div className="rounded-xl border border-white/10 bg-panel-strong/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-100">{member.displayName}</p>
          <p className="text-xs text-slate-400">{member.id}</p>
          <p className="mt-1 text-xs text-slate-500">{member.model}</p>
          <p className="text-xs text-slate-500">{member.workspace}</p>
        </div>
        <span className="rounded-md bg-white/8 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-slate-300">
          {member.source}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.05]"
        >
          {editing ? "Close" : "Override"}
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onSave({ displayName, role, deviceLabel });
            setEditing(false);
          }}
          className="mt-3 space-y-2"
        >
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            placeholder="Display name"
          />
          <input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            placeholder="Role"
          />
          <input
            value={deviceLabel}
            onChange={(event) => setDeviceLabel(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            placeholder="Device label"
          />
          <button
            type="submit"
            className="rounded-md border border-sky-300/30 bg-sky-400/15 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-400/25"
          >
            Save Override
          </button>
        </form>
      ) : null}
    </div>
  );
}
