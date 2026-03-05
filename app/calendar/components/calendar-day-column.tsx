"use client";

import CalendarTaskCard, { type CalendarEvent } from "./calendar-task-card";

interface DayInfo {
  date: Date;
  dateStr: string;
  dayName: string;
  dayNum: number;
  isToday: boolean;
}

interface CalendarDayColumnProps {
  day: DayInfo;
  events: CalendarEvent[];
  onRunNow: (event: CalendarEvent) => void;
  runningEventId: string;
}

export default function CalendarDayColumn({ day, events, onRunNow, runningEventId }: CalendarDayColumnProps) {
  const sorted = [...events].sort((a, b) => a.sortMinute - b.sortMinute);

  return (
    <div className="flex flex-col">
      <div
        className={`border-b px-2 py-2 text-center ${
          day.isToday
            ? "border-sky-400/30 bg-sky-400/10"
            : "border-white/5 bg-white/[0.02]"
        }`}
      >
        <p
          className={`text-[10px] font-semibold uppercase tracking-widest ${
            day.isToday ? "text-sky-300" : "text-slate-500"
          }`}
        >
          {day.dayName}
        </p>
        <p
          className={`text-sm font-medium ${
            day.isToday ? "text-sky-200" : "text-slate-300"
          }`}
        >
          {day.dayNum}
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-1.5">
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-[10px] text-slate-600">—</p>
        ) : (
          sorted.map((event) => (
            <CalendarTaskCard
              key={event.id}
              event={event}
              onRunNow={onRunNow}
              isRunning={runningEventId === event.originalId}
            />
          ))
        )}
      </div>
    </div>
  );
}

export type { DayInfo };
