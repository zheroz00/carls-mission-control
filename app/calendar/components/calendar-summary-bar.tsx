"use client";

type KindFilter = "all" | "cron" | "proactive";
type SourceFilter = "all" | "local" | "gateway";
type ViewMode = "week" | "today";

interface CalendarSummaryBarProps {
  cronCount: number;
  proactiveCount: number;
  kindFilter: KindFilter;
  sourceFilter: SourceFilter;
  viewMode: ViewMode;
  onKindFilterChange: (value: KindFilter) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
  onViewModeChange: (value: ViewMode) => void;
  onRefresh: () => void;
  weekLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border border-sky-300/30 bg-sky-400/15 text-sky-200"
          : "border border-white/10 bg-white/[0.02] text-slate-400 hover:text-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

export default function CalendarSummaryBar({
  cronCount,
  proactiveCount,
  kindFilter,
  sourceFilter,
  viewMode,
  onKindFilterChange,
  onSourceFilterChange,
  onViewModeChange,
  onRefresh,
  weekLabel,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
}: CalendarSummaryBarProps) {
  const total = cronCount + proactiveCount;

  return (
    <section className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-panel/80 p-3">
      {/* Kind filter pills */}
      <div className="flex items-center gap-1.5">
        <Pill active={kindFilter === "all"} onClick={() => onKindFilterChange("all")}>
          All ({total})
        </Pill>
        <Pill active={kindFilter === "cron"} onClick={() => onKindFilterChange("cron")}>
          Cron ({cronCount})
        </Pill>
        <Pill active={kindFilter === "proactive"} onClick={() => onKindFilterChange("proactive")}>
          Proactive ({proactiveCount})
        </Pill>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Week navigation */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrevWeek}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          &larr;
        </button>
        <span className="min-w-[140px] text-center text-xs font-medium text-slate-300">
          {weekLabel}
        </span>
        <button
          type="button"
          onClick={onNextWeek}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          &rarr;
        </button>
        <button
          type="button"
          onClick={onGoToToday}
          className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          Today
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* View toggle + source filter + refresh */}
      <div className="flex items-center gap-1.5">
        <Pill active={viewMode === "week"} onClick={() => onViewModeChange("week")}>
          Week
        </Pill>
        <Pill active={viewMode === "today"} onClick={() => onViewModeChange("today")}>
          Today
        </Pill>
        <select
          value={sourceFilter}
          onChange={(e) => onSourceFilterChange(e.target.value as SourceFilter)}
          className="rounded-lg border border-white/10 bg-panel-strong/70 px-2 py-1.5 text-xs text-slate-100"
        >
          <option value="all">All Sources</option>
          <option value="local">Local</option>
          <option value="gateway">Gateway</option>
        </select>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-lg border border-sky-300/30 bg-sky-400/15 px-3 py-1.5 text-xs text-sky-100 hover:bg-sky-400/25"
        >
          Refresh
        </button>
      </div>
    </section>
  );
}
