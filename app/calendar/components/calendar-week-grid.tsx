"use client";

import CalendarDayColumn, { type DayInfo } from "./calendar-day-column";
import type { CalendarEvent } from "./calendar-task-card";

interface CalendarWeekGridProps {
  weekDays: DayInfo[];
  events: Map<string, CalendarEvent[]>;
  onRunNow: (event: CalendarEvent) => void;
  runningEventId: string;
}

export default function CalendarWeekGrid({ weekDays, events, onRunNow, runningEventId }: CalendarWeekGridProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel/75">
      <div className="grid grid-cols-7 divide-x divide-white/5">
        {weekDays.map((day) => (
          <CalendarDayColumn
            key={day.dateStr}
            day={day}
            events={events.get(day.dateStr) ?? []}
            onRunNow={onRunNow}
            runningEventId={runningEventId}
          />
        ))}
      </div>
    </div>
  );
}
