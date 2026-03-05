"use client";

import { getColorClasses, type TaskColor } from "@/lib/cron-utils";

export interface CalendarEvent {
  id: string;
  title: string;
  time: string;
  kind: "cron" | "proactive";
  source: "local" | "gateway";
  color: TaskColor;
  schedule?: string;
  status?: string;
  originalId: string;
  sortMinute: number;
}

interface CalendarTaskCardProps {
  event: CalendarEvent;
  onRunNow: (event: CalendarEvent) => void;
  isRunning: boolean;
}

export default function CalendarTaskCard({ event, onRunNow, isRunning }: CalendarTaskCardProps) {
  const colors = getColorClasses(event.color);

  return (
    <button
      type="button"
      onClick={() => {
        if (event.source === "local") onRunNow(event);
      }}
      disabled={event.source !== "local" || isRunning}
      className={`group relative flex w-full items-start gap-1.5 rounded-lg border ${colors.border} ${colors.bg} px-2 py-1.5 text-left transition hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100`}
    >
      <div className={`mt-0.5 h-3 w-1 shrink-0 rounded-full ${colors.bar}`} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-xs font-medium ${colors.text}`}>{event.title}</p>
        <p className="font-mono text-[10px] text-slate-400">{event.time}</p>
      </div>
      {event.source === "local" && (
        <span className="absolute right-1 top-1 hidden rounded bg-white/10 px-1 py-0.5 text-[9px] text-slate-300 group-hover:block">
          {isRunning ? "..." : "Run"}
        </span>
      )}
    </button>
  );
}
