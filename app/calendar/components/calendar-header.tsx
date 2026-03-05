"use client";

interface CalendarHeaderProps {
  cronCount: number;
  proactiveCount: number;
  gatewayConnected: boolean;
  gatewayEndpoint?: string;
}

export default function CalendarHeader({
  cronCount,
  proactiveCount,
  gatewayConnected,
  gatewayEndpoint,
}: CalendarHeaderProps) {
  return (
    <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Calendar</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
        Scheduled Tasks
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
        <span>{cronCount} cron jobs</span>
        <span>{proactiveCount} proactive tasks</span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
            gatewayConnected
              ? "bg-emerald-400/15 text-emerald-300"
              : "bg-slate-500/20 text-slate-300"
          }`}
        >
          {gatewayConnected ? "Gateway Linked" : "Gateway Unavailable"}
        </span>
        {gatewayEndpoint && (
          <span className="text-xs text-slate-500">Endpoint: {gatewayEndpoint}</span>
        )}
      </div>
    </section>
  );
}
