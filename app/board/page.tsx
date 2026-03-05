"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ActivityEvent, Project, Task, TaskColumn, TeamMember } from "@/lib/types";

const COLUMN_CONFIG: { key: TaskColumn; title: string }[] = [
  { key: "todo", title: "To Do" },
  { key: "in_progress", title: "In Progress" },
  { key: "review", title: "Review" },
  { key: "done", title: "Done" },
];

const PRIORITY_STYLES: Record<Task["priority"], string> = {
  high: "bg-rose-400/15 text-rose-300",
  medium: "bg-amber-400/15 text-amber-300",
  low: "bg-emerald-400/15 text-emerald-300",
};

interface TasksPayload {
  tasks: Task[];
}

interface ProjectsPayload {
  projects: Project[];
}

interface TeamPayload {
  members: TeamMember[];
}

interface ActivityPayload {
  events: ActivityEvent[];
}

interface StreamPayload {
  type?: string;
  event?: ActivityEvent;
  events?: ActivityEvent[];
}

interface DraftTask {
  title: string;
  description: string;
  priority: Task["priority"];
  assigneeId: string;
  projectId: string;
  column: TaskColumn;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "n/a";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<DraftTask>({
    title: "",
    description: "",
    priority: "medium",
    assigneeId: "main",
    projectId: "",
    column: "todo",
  });

  async function fetchBoardData() {
    try {
      const [tasksRes, projectsRes, teamRes, activityRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/projects"),
        fetch("/api/team"),
        fetch("/api/activity?limit=40"),
      ]);

      const tasksPayload = (await tasksRes.json()) as TasksPayload;
      const projectsPayload = (await projectsRes.json()) as ProjectsPayload;
      const teamPayload = (await teamRes.json()) as TeamPayload;
      const activityPayload = (await activityRes.json()) as ActivityPayload;

      setTasks(tasksPayload.tasks ?? []);
      setProjects(projectsPayload.projects ?? []);
      setMembers(teamPayload.members ?? []);
      setEvents(activityPayload.events ?? []);
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load board data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchBoardData();
    let refreshTimer: number | undefined;
    const source = new EventSource("/api/activity/stream");

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      refreshTimer = window.setTimeout(() => {
        void fetchBoardData();
      }, 250);
    };

    source.addEventListener("snapshot", (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamPayload;
        if (Array.isArray(payload.events)) {
          setEvents(payload.events);
        }
      } catch {
        // ignore malformed stream payload
      }
    });

    source.addEventListener("activity", (event) => {
      try {
        const payload = JSON.parse(event.data) as StreamPayload;
        const nextEvent = payload.event;
        if (!nextEvent) {
          return;
        }
        setEvents((current) => [nextEvent, ...current].slice(0, 40));
        if (nextEvent.kind === "task" || nextEvent.kind === "system") {
          scheduleRefresh();
        }
      } catch {
        // ignore malformed stream payload
      }
    });

    source.onerror = () => {
      // Browser EventSource auto-reconnect handles transient issues.
    };

    return () => {
      source.close();
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
    };
  }, []);

  const grouped = useMemo(() => {
    const map = new Map<TaskColumn, Task[]>(COLUMN_CONFIG.map((col) => [col.key, []]));
    for (const task of tasks) {
      map.get(task.column)?.push(task);
    }
    return map;
  }, [tasks]);

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          priority: draft.priority,
          assigneeId: draft.assigneeId,
          projectId: draft.projectId || null,
          column: draft.column,
        }),
      });

      if (!response.ok) {
        throw new Error("failed");
      }

      setDraft((current) => ({ ...current, title: "", description: "" }));
      await fetchBoardData();
    } catch {
      setError("Unable to create task.");
    } finally {
      setSubmitting(false);
    }
  }

  async function patchTask(taskId: string, patch: Partial<Task>) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchBoardData();
    } catch {
      setError("Unable to update task.");
    }
  }

  async function removeTask(taskId: string) {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchBoardData();
    } catch {
      setError("Unable to delete task.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Task Board</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Kanban + Activity Feed
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Full CRUD task board with assignee/project ownership and live mission activity.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <form
          onSubmit={createTask}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_2fr_1fr_1fr_1fr_auto]"
        >
          <input
            value={draft.title}
            onChange={(event) =>
              setDraft((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="New task title"
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <input
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Description"
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <select
            value={draft.assigneeId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, assigneeId: event.target.value }))
            }
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100"
          >
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </select>
          <select
            value={draft.projectId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, projectId: event.target.value }))
            }
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">No Project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <select
            value={draft.priority}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                priority: event.target.value as Task["priority"],
              }))
            }
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl border border-sky-300/30 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/25 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Adding..." : "Add Task"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_3fr]">
        <article className="rounded-2xl border border-white/10 bg-panel/80 p-4">
          <header className="flex items-center justify-between border-b border-white/10 pb-3">
            <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              Live Activity
            </h2>
            <span className="text-xs text-slate-500">{events.length}</span>
          </header>
          <div className="mt-3 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-slate-500">No activity events yet.</p>
            ) : (
              events.slice(0, 20).map((event) => (
                <div
                  key={event.id}
                  className="rounded-lg border border-white/10 bg-panel-strong/70 p-2.5"
                >
                  <p className="text-xs uppercase tracking-[0.11em] text-slate-500">
                    {event.kind} • {event.actorId}
                  </p>
                  <p className="mt-1 text-sm text-slate-200">{event.message}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatTimestamp(event.ts)}</p>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="grid gap-4 xl:grid-cols-4">
          {COLUMN_CONFIG.map((column) => {
            const items = grouped.get(column.key) ?? [];

            return (
              <div key={column.key} className="rounded-2xl border border-white/10 bg-panel/80 p-3">
                <header className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                    {column.title}
                  </h3>
                  <span className="rounded-md bg-white/8 px-2 py-0.5 text-xs text-slate-300">
                    {items.length}
                  </span>
                </header>
                <div className="mt-3 space-y-3">
                  {loading ? (
                    <p className="text-sm text-slate-500">Loading...</p>
                  ) : items.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-sm text-slate-500">
                      No tasks.
                    </p>
                  ) : (
                    items.map((task) => (
                      <TaskCard
                        key={`${task.id}-${task.updatedAt}`}
                        task={task}
                        members={members}
                        projects={projects}
                        onPatch={patchTask}
                        onDelete={removeTask}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </article>
      </section>
    </div>
  );
}

function TaskCard({
  task,
  members,
  projects,
  onPatch,
  onDelete,
}: {
  task: Task;
  members: TeamMember[];
  projects: Project[];
  onPatch: (taskId: string, patch: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: task.title,
    description: task.description ?? "",
    column: task.column,
    assigneeId: task.assigneeId,
    projectId: task.projectId ?? "",
    priority: task.priority,
  });

  return (
    <div className="rounded-xl border border-white/10 bg-panel-strong/70 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-100">{task.title}</p>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] ${PRIORITY_STYLES[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>
      {task.description ? <p className="mt-2 text-xs text-slate-400">{task.description}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.05]"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          className="rounded-md border border-rose-300/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-400/15"
        >
          Delete
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onPatch(task.id, {
              title: form.title,
              description: form.description,
              column: form.column,
              assigneeId: form.assigneeId,
              projectId: form.projectId || null,
              priority: form.priority,
            });
            setEditing(false);
          }}
          className="mt-3 space-y-2"
        >
          <input
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
          />
          <input
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.column}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  column: event.target.value as TaskColumn,
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              {COLUMN_CONFIG.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.title}
                </option>
              ))}
            </select>
            <select
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value as Task["priority"],
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={form.assigneeId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assigneeId: event.target.value,
                }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <select
              value={form.projectId}
              onChange={(event) =>
                setForm((current) => ({ ...current, projectId: event.target.value }))
              }
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="">No project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md border border-sky-300/30 bg-sky-400/15 px-2.5 py-1 text-xs font-medium text-sky-100 hover:bg-sky-400/25"
          >
            Save
          </button>
        </form>
      ) : null}
      <p className="mt-3 text-[11px] text-slate-500">Updated {formatTimestamp(task.updatedAt)}</p>
    </div>
  );
}
