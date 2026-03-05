"use client";

import { useEffect, useMemo, useState } from "react";
import { ActivityEvent, OfficeLayout, OfficePresence } from "@/lib/types";

interface OfficePayload {
  layout: OfficeLayout;
  presence: OfficePresence[];
  recentEvents: ActivityEvent[];
  updatedAt: string;
}

const ZONE_LABELS: Record<OfficePresence["zone"], string> = {
  desk: "At Desk",
  meeting: "Meeting",
  idle: "Idle",
  review: "Review",
};

export default function OfficePage() {
  const [data, setData] = useState<OfficePayload | null>(null);
  const [error, setError] = useState("");

  async function fetchOffice() {
    try {
      const response = await fetch("/api/office");
      const payload = (await response.json()) as OfficePayload;
      setData(payload);
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load office telemetry.");
    }
  }

  useEffect(() => {
    let refreshTimer: number | undefined;
    const kickoff = window.setTimeout(() => {
      void fetchOffice();
    }, 0);

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        void fetchOffice();
      }, 250);
    };

    const source = new EventSource("/api/activity/stream");
    source.addEventListener("activity", () => {
      scheduleRefresh();
    });
    source.onerror = () => {
      // Browser EventSource auto-reconnect handles transient issues.
    };

    const timer = window.setInterval(() => {
      void fetchOffice();
    }, 30000);

    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
      source.close();
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, []);

  const seatByAgent = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    for (const seat of data?.layout?.seats ?? []) {
      map.set(seat.agentId, { x: seat.x, y: seat.y });
    }
    return map;
  }, [data]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Office</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Agent Office Visualizer
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Lightweight live 2D map of agent presence and current zone assignment.
        </p>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!data ? (
        <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-slate-500">
          Loading office map...
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[2.2fr_1fr]">
          <article className="rounded-2xl border border-white/10 bg-panel/80 p-4">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
                Floor Map
              </h2>
              <p className="text-xs text-slate-500">
                Updated {new Date(data.updatedAt).toLocaleTimeString()}
              </p>
            </header>
            <div
              className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(12,17,26,1),rgba(16,22,33,1))] p-4"
              style={{
                minHeight: "360px",
                backgroundImage:
                  "radial-gradient(circle at 10% 20%, rgba(56,189,248,0.08), transparent 35%), radial-gradient(circle at 80% 0%, rgba(56,189,248,0.1), transparent 28%)",
              }}
            >
              <div
                className="grid h-full gap-2"
                style={{
                  gridTemplateColumns: `repeat(${data.layout.width}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${data.layout.height}, minmax(64px, 1fr))`,
                }}
              >
                {Array.from({ length: data.layout.width * data.layout.height }).map((_, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-white/10 bg-black/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  />
                ))}
              </div>

              {data.presence.map((presence) => {
                const seat = seatByAgent.get(presence.agentId) ?? { x: 1, y: data.layout.height };
                const left = ((seat.x - 0.5) / data.layout.width) * 100;
                const top = ((seat.y - 0.5) / data.layout.height) * 100;
                const active = presence.status === "active";

                return (
                  <div
                    key={presence.agentId}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.11em] transition-all duration-700 ${
                      active
                        ? "animate-pulse border-emerald-300/50 bg-emerald-400/20 text-emerald-100"
                        : "border-sky-300/40 bg-sky-400/15 text-sky-100"
                    }`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    title={`${presence.agentId} • ${ZONE_LABELS[presence.zone]}`}
                  >
                    {presence.agentId}
                  </div>
                );
              })}
            </div>
          </article>

          <article className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-panel/80 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
                Presence
              </h2>
              <div className="mt-3 space-y-2">
                {data.presence.map((presence) => (
                  <div
                    key={presence.agentId}
                    className="rounded-lg border border-white/10 bg-panel-strong/70 p-2.5"
                  >
                    <p className="text-sm font-medium text-slate-100">{presence.agentId}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {ZONE_LABELS[presence.zone]} • {presence.status}
                    </p>
                    {presence.taskId ? (
                      <p className="mt-1 text-xs text-slate-500">Task {presence.taskId}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-panel/80 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-300">
                Recent Office Events
              </h2>
              <div className="mt-3 space-y-2">
                {data.recentEvents.slice(0, 12).map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-white/10 bg-panel-strong/70 p-2.5"
                  >
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">
                      {event.kind} • {event.actorId}
                    </p>
                    <p className="mt-1 text-sm text-slate-200">{event.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
}
