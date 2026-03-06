"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPayload } from "@/lib/types";
import { assignColor, getOccurrencesInRange, parseCron } from "@/lib/cron-utils";
import CalendarHeader from "./components/calendar-header";
import CalendarSummaryBar from "./components/calendar-summary-bar";
import CalendarWeekGrid from "./components/calendar-week-grid";
import CalendarTodayView from "./components/calendar-today-view";
import type { CalendarEvent } from "./components/calendar-task-card";
import type { DayInfo } from "./components/calendar-day-column";

type KindFilter = "all" | "cron" | "proactive";
type SourceFilter = "all" | "local" | "gateway" | "openclaw-config" | "gateway-rpc";
type ViewMode = "week" | "today";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekBounds(weekOffset: number): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - dayOfWeek + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekDays(weekStart: Date): DayInfo[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = formatDateStr(today);

  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    const dateStr = formatDateStr(date);
    return {
      date,
      dateStr,
      dayName: DAY_NAMES[date.getDay()],
      dayNum: date.getDate(),
      isToday: dateStr === todayStr,
    };
  });
}

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatWeekLabel(start: Date, end: Date): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  const yearFmt = new Intl.DateTimeFormat("en-US", { year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}, ${yearFmt.format(end)}`;
}

function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${ampm}`;
}

export default function CalendarPage() {
  const [calendar, setCalendar] = useState<CalendarPayload>({
    cronJobs: [],
    proactiveTasks: [],
    gatewayConnected: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [runningEventId, setRunningEventId] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);

  const fetchCalendar = useCallback(async () => {
    try {
      const response = await fetch("/api/calendar");
      const payload = (await response.json()) as CalendarPayload;
      setCalendar(payload);
      setError("");
    } catch {
      setError("Unable to load calendar data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalendar();
  }, [fetchCalendar]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getWeekBounds(weekOffset), [weekOffset]);
  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const weekLabel = useMemo(() => formatWeekLabel(weekStart, weekEnd), [weekStart, weekEnd]);

  // Expand cron jobs and proactive tasks into CalendarEvents mapped by date
  const weekEvents = useMemo(() => {
    const eventsByDate = new Map<string, CalendarEvent[]>();

    // Expand cron jobs
    for (const job of calendar.cronJobs) {
      if (kindFilter === "proactive") continue;
      if (sourceFilter !== "all" && job.source !== sourceFilter) continue;

      const schedule = parseCron(job.schedule);
      const occurrences = getOccurrencesInRange(schedule, weekStart, weekEnd);
      const color = assignColor(job.name, job.color);

      for (const occ of occurrences) {
        const dateStr = formatDateStr(occ);
        const h = occ.getHours();
        const m = occ.getMinutes();

        const event: CalendarEvent = {
          id: `${job.id}-${dateStr}-${h}-${m}`,
          title: job.name,
          time: formatTime(h, m),
          kind: "cron",
          source: job.source,
          color,
          schedule: schedule.description,
          originalId: job.id,
          sortMinute: h * 60 + m,
        };

        const existing = eventsByDate.get(dateStr) ?? [];
        existing.push(event);
        eventsByDate.set(dateStr, existing);
      }
    }

    // Map proactive tasks
    for (const task of calendar.proactiveTasks) {
      if (kindFilter === "cron") continue;
      if (sourceFilter !== "all" && task.source !== sourceFilter) continue;

      const dueDate = new Date(task.dueAt);
      if (dueDate < weekStart || dueDate > weekEnd) continue;

      const dateStr = formatDateStr(dueDate);
      const h = dueDate.getHours();
      const m = dueDate.getMinutes();
      const color = assignColor(task.title);

      const event: CalendarEvent = {
        id: `${task.id}-${dateStr}`,
        title: task.title,
        time: formatTime(h, m),
        kind: "proactive",
        source: task.source,
        color,
        status: task.status,
        originalId: task.id,
        sortMinute: h * 60 + m,
      };

      const existing = eventsByDate.get(dateStr) ?? [];
      existing.push(event);
      eventsByDate.set(dateStr, existing);
    }

    return eventsByDate;
  }, [calendar, kindFilter, sourceFilter, weekStart, weekEnd]);

  // Today's events for "Today" view
  const todayStr = formatDateStr(new Date());
  const todayEvents = weekEvents.get(todayStr) ?? [];
  const todayLabel = new Intl.DateTimeFormat("en-US", { dateStyle: "full" }).format(new Date());

  async function runNow(event: CalendarEvent) {
    if (event.source !== "local") return;

    setRunningEventId(event.originalId);
    setActionMessage("");

    try {
      const response = await fetch("/api/calendar/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: event.kind === "cron" ? "cron" : "proactive",
          id: event.originalId.replace(/^(cron|task)-/, ""),
          source: event.source,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Run now failed");
      }
      setActionMessage(`Triggered: ${event.title}`);
      await fetchCalendar();
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Failed to trigger event.";
      setError(message);
    } finally {
      setRunningEventId("");
    }
  }

  return (
    <div className="space-y-6">
      <CalendarHeader
        cronCount={calendar.cronJobs.length}
        proactiveCount={calendar.proactiveTasks.length}
        gatewayConnected={calendar.gatewayConnected}
        gatewayEndpoint={calendar.gatewayEndpoint}
      />

      <CalendarSummaryBar
        cronCount={calendar.cronJobs.length}
        proactiveCount={calendar.proactiveTasks.length}
        kindFilter={kindFilter}
        sourceFilter={sourceFilter}
        viewMode={viewMode}
        onKindFilterChange={setKindFilter}
        onSourceFilterChange={setSourceFilter}
        onViewModeChange={setViewMode}
        onRefresh={() => void fetchCalendar()}
        weekLabel={weekLabel}
        onPrevWeek={() => setWeekOffset((o) => o - 1)}
        onNextWeek={() => setWeekOffset((o) => o + 1)}
        onGoToToday={() => setWeekOffset(0)}
      />

      {error && (
        <div className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
          {actionMessage}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-panel/60 px-6 py-12 text-center text-slate-400">
          Loading calendar entries...
        </div>
      ) : viewMode === "week" ? (
        <CalendarWeekGrid
          weekDays={weekDays}
          events={weekEvents}
          onRunNow={runNow}
          runningEventId={runningEventId}
        />
      ) : (
        <CalendarTodayView
          events={todayEvents}
          onRunNow={runNow}
          runningEventId={runningEventId}
          dayLabel={todayLabel}
        />
      )}
    </div>
  );
}
