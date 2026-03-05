"use client";

import { getColorClasses } from "@/lib/cron-utils";
import type { CalendarEvent } from "./calendar-task-card";

interface CalendarTodayViewProps {
  events: CalendarEvent[];
  onRunNow: (event: CalendarEvent) => void;
  runningEventId: string;
  dayLabel: string;
}

export default function CalendarTodayView({ events, onRunNow, runningEventId, dayLabel }: CalendarTodayViewProps) {
  const sorted = [...events].sort((a, b) => a.sortMinute - b.sortMinute);

  return (
    <div className="rounded-2xl border border-white/10 bg-panel/75 p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-300">
        {dayLabel}
      </h2>
      {sorted.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No scheduled tasks for this day.
        </p>
      ) : (
        <div className="space-y-2">
          {sorted.map((event) => {
            const colors = getColorClasses(event.color);
            return (
              <div
                key={event.id}
                className={`flex items-center gap-3 rounded-xl border ${colors.border} ${colors.bg} p-3`}
              >
                <div className={`h-8 w-1 shrink-0 rounded-full ${colors.bar}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${colors.text}`}>{event.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono">{event.time}</span>
                    {event.schedule && (
                      <span className="rounded bg-white/8 px-1.5 py-0.5">{event.schedule}</span>
                    )}
                    <span className="rounded bg-white/8 px-1.5 py-0.5 uppercase tracking-wide">
                      {event.kind}
                    </span>
                    <span className="rounded bg-white/8 px-1.5 py-0.5 uppercase tracking-wide">
                      {event.source}
                    </span>
                    {event.status && (
                      <span className="rounded bg-white/8 px-1.5 py-0.5">{event.status}</span>
                    )}
                  </div>
                </div>
                {event.source === "local" && (
                  <button
                    type="button"
                    onClick={() => onRunNow(event)}
                    disabled={runningEventId === event.originalId}
                    className="shrink-0 rounded-md border border-sky-300/30 bg-sky-400/15 px-3 py-1.5 text-xs text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.04] disabled:text-slate-500"
                  >
                    {runningEventId === event.originalId ? "Running..." : "Run now"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
