"use client";

import { useMemo, useState, useEffect } from "react";
import { ReversePromptTemplate, Task } from "@/lib/types";

interface GatewayStatus {
  connected: boolean;
  baseUrl: string;
  checkedAt: string;
  details?: string;
}

interface DashboardStats {
  totalTasks: number;
  inProgressTasks: number;
  cronJobs: number;
  memoryDays: number;
  docs: number;
  projects: number;
  teamMembers: number;
}

interface ReversePromptsPayload {
  templates: ReversePromptTemplate[];
}

interface TasksPayload {
  tasks: Task[];
}

interface CalendarPayload {
  cronJobs?: unknown[];
}

interface MemoryPayload {
  memoryDays?: unknown[];
}

interface DocsPayload {
  docs?: unknown[];
}

interface ProjectsPayload {
  projects?: unknown[];
}

interface TeamPayload {
  members?: unknown[];
}

export default function Dashboard() {
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalTasks: 0,
    inProgressTasks: 0,
    cronJobs: 0,
    memoryDays: 0,
    docs: 0,
    projects: 0,
    teamMembers: 0,
  });
  const [templates, setTemplates] = useState<ReversePromptTemplate[]>([]);
  const [copiedId, setCopiedId] = useState<string>("");

  useEffect(() => {
    async function fetchData() {
      try {
        const [
          statusRes,
          tasksRes,
          calendarRes,
          memoryRes,
          docsRes,
          projectsRes,
          teamRes,
          promptsRes,
        ] = await Promise.all([
          fetch("/api/gateway/status"),
          fetch("/api/tasks"),
          fetch("/api/calendar"),
          fetch("/api/memory"),
          fetch("/api/docs"),
          fetch("/api/projects"),
          fetch("/api/team"),
          fetch("/api/reverse-prompts"),
        ]);

        const status = (await statusRes.json()) as GatewayStatus;
        const tasks = (await tasksRes.json()) as TasksPayload;
        const calendar = (await calendarRes.json()) as CalendarPayload;
        const memory = (await memoryRes.json()) as MemoryPayload;
        const docs = (await docsRes.json()) as DocsPayload;
        const projects = (await projectsRes.json()) as ProjectsPayload;
        const team = (await teamRes.json()) as TeamPayload;
        const prompts = (await promptsRes.json()) as ReversePromptsPayload;

        setGatewayStatus(status);
        setStats({
          totalTasks: tasks.tasks?.length || 0,
          inProgressTasks:
            tasks.tasks?.filter((task) => task.column === "in_progress").length || 0,
          cronJobs: calendar.cronJobs?.length || 0,
          memoryDays: memory.memoryDays?.length || 0,
          docs: docs.docs?.length || 0,
          projects: projects.projects?.length || 0,
          teamMembers: team.members?.length || 0,
        });
        setTemplates(prompts.templates ?? []);
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      }
    }

    void fetchData();
  }, []);

  async function copyPrompt(template: ReversePromptTemplate) {
    try {
      await navigator.clipboard.writeText(template.prompt);
      setCopiedId(template.id);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch {
      setCopiedId("");
    }
  }

  const quickLinks = useMemo(
    () => [
      { href: "/control", label: "Control" },
      { href: "/board", label: "Task Board" },
      { href: "/calendar", label: "Calendar" },
      { href: "/projects", label: "Projects" },
      { href: "/team", label: "Team" },
      { href: "/office", label: "Office" },
      { href: "/memory", label: "Memory" },
      { href: "/docs", label: "Docs" },
    ],
    [],
  );

  return (
    <div className="space-y-7">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Dashboard</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Mission Control
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              gatewayStatus?.connected
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-rose-400/15 text-rose-300"
            }`}
          >
            {gatewayStatus?.connected ? "Gateway Linked" : "Gateway Offline"}
          </span>
          {gatewayStatus ? (
            <span className="text-xs text-slate-400">
              {gatewayStatus.baseUrl} • {gatewayStatus.details ?? "status unavailable"}
            </span>
          ) : null}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Tasks" value={stats.totalTasks} />
        <StatCard label="In Progress" value={stats.inProgressTasks} />
        <StatCard label="Cron Jobs" value={stats.cronJobs} />
        <StatCard label="Memory Days" value={stats.memoryDays} />
        <StatCard label="Documents" value={stats.docs} />
        <StatCard label="Projects" value={stats.projects} />
        <StatCard label="Team Members" value={stats.teamMembers} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">
          Quick Access
        </h2>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
          {quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-center text-sm text-slate-300 transition hover:border-white/25 hover:bg-white/[0.06] hover:text-slate-100"
            >
              {link.label}
            </a>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-300">
          Reverse Prompt Helpers
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Use these templates to discover custom tools and next actions.
        </p>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {templates.map((template) => (
            <article
              key={template.id}
              className="rounded-xl border border-white/10 bg-panel-strong/70 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">{template.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{template.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyPrompt(template)}
                  className="rounded-lg border border-sky-300/30 bg-sky-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-100 transition hover:bg-sky-400/25"
                >
                  {copiedId === template.id ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="mt-3 rounded-lg border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-300">
                {template.prompt}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-panel/80 p-5">
      <p className="text-xs uppercase tracking-[0.13em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-100">{value}</p>
    </article>
  );
}
