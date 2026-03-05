"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityEvent, TeamMember } from "@/lib/types";

interface TeamPayload {
  members: TeamMember[];
}

interface ControlResponse {
  ok?: boolean;
  error?: string;
  action?: string;
  mode?: string;
  task?: { id: string; title: string; column: string };
}

interface StreamPayload {
  type?: string;
  event?: ActivityEvent;
  events?: ActivityEvent[];
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

export default function ControlPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState("main");
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [runningAction, setRunningAction] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/team")
      .then((response) => response.json())
      .then((payload: TeamPayload) => {
        const nextMembers = payload.members ?? [];
        setMembers(nextMembers);
        if (nextMembers.length > 0) {
          setSelectedAgentId(nextMembers[0].id);
        }
      })
      .catch(() => {
        setError("Failed to load team members.");
      });
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/activity/stream");
    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamPayload;
        if (Array.isArray(payload.events)) {
          setActivity(payload.events);
        }
      } catch {
        // ignore parse errors
      }
    });
    source.addEventListener("activity", (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamPayload;
        const next = payload.event;
        if (!next) {
          return;
        }
        setActivity((current) => [next, ...current].slice(0, 40));
      } catch {
        // ignore parse errors
      }
    });
    source.onerror = () => {
      // no-op, browser reconnects automatically
    };

    return () => {
      source.close();
    };
  }, []);

  async function runAction(action: string) {
    setRunningAction(action);
    setError("");
    setStatusMessage("");

    try {
      const response = await fetch("/api/control", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          agentId: selectedAgentId,
        }),
      });
      const payload = (await response.json()) as ControlResponse;
      if (!response.ok) {
        throw new Error(payload.error || "Control action failed.");
      }

      if (payload.task) {
        setStatusMessage(
          `${payload.action} -> ${payload.task.title} (${payload.task.column})`,
        );
      } else {
        setStatusMessage(`${payload.action ?? action} completed.`);
      }
    } catch (actionError) {
      const message =
        actionError instanceof Error
          ? actionError.message
          : "Control action failed.";
      setError(message);
    } finally {
      setRunningAction("");
    }
  }

  const actionButtons = useMemo(
    () => [
      {
        id: "create_demo_task",
        label: "Create Demo Task",
        hint: "Adds a new local task assigned to selected agent.",
      },
      {
        id: "advance_task",
        label: "Advance Next Task",
        hint: "Moves first non-done task to the next workflow stage.",
      },
      {
        id: "emit_cron_event",
        label: "Emit Cron Event",
        hint: "Pushes a synthetic cron activity event.",
      },
      {
        id: "toggle_agent",
        label: "Toggle Agent Active/Idle",
        hint: "Creates or resolves in-progress work for selected agent.",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Control</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Interactive Operations Panel
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Trigger simulation actions and watch Board/Office react live.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-slate-300">Agent</label>
          <select
            value={selectedAgentId}
            onChange={(event) => setSelectedAgentId(event.target.value)}
            className="rounded-lg border border-white/10 bg-panel-strong/75 px-3 py-1.5 text-sm text-slate-100"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName} ({member.id})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {actionButtons.map((action) => (
            <button
              key={action.id}
              type="button"
              disabled={runningAction.length > 0}
              onClick={() => void runAction(action.id)}
              className="rounded-xl border border-sky-300/30 bg-sky-400/15 p-3 text-left transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <p className="text-sm font-semibold text-sky-100">
                {runningAction === action.id ? "Running..." : action.label}
              </p>
              <p className="mt-1 text-xs text-slate-300">{action.hint}</p>
            </button>
          ))}
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {statusMessage}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <header className="flex items-center justify-between border-b border-white/10 pb-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Live Activity Stream
          </h2>
          <span className="text-xs text-slate-500">{activity.length}</span>
        </header>
        <div className="mt-3 space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity events yet.</p>
          ) : (
            activity.map((event) => (
              <article
                key={event.id}
                className="rounded-lg border border-white/10 bg-panel-strong/70 p-2.5"
              >
                <p className="text-xs uppercase tracking-[0.11em] text-slate-500">
                  {event.kind} • {event.actorId}
                </p>
                <p className="mt-1 text-sm text-slate-200">{event.message}</p>
                <p className="mt-1 text-xs text-slate-500">{formatTimestamp(event.ts)}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

