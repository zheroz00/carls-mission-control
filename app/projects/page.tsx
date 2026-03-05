"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DocItem, MemoryDay, MemoryItem, Project, Task, TeamMember } from "@/lib/types";

interface ProjectsPayload {
  projects: Project[];
}

interface TasksPayload {
  tasks: Task[];
}

interface DocsPayload {
  docs: DocItem[];
}

interface MemoryPayload {
  memoryDays: MemoryDay[];
}

interface TeamPayload {
  members: TeamMember[];
}

function flattenMemoryItems(days: MemoryDay[]): MemoryItem[] {
  return days.flatMap((day) => day.items);
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    objective: "",
    ownerId: "main",
    status: "active" as Project["status"],
  });

  async function fetchData() {
    try {
      const [projectsRes, tasksRes, docsRes, memoryRes, teamRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/tasks"),
        fetch("/api/docs"),
        fetch("/api/memory"),
        fetch("/api/team"),
      ]);

      const projectsPayload = (await projectsRes.json()) as ProjectsPayload;
      const tasksPayload = (await tasksRes.json()) as TasksPayload;
      const docsPayload = (await docsRes.json()) as DocsPayload;
      const memoryPayload = (await memoryRes.json()) as MemoryPayload;
      const teamPayload = (await teamRes.json()) as TeamPayload;

      setProjects(projectsPayload.projects ?? []);
      setTasks(tasksPayload.tasks ?? []);
      setDocs(docsPayload.docs ?? []);
      setMemoryItems(flattenMemoryItems(memoryPayload.memoryDays ?? []));
      setMembers(teamPayload.members ?? []);
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Failed to load project data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) {
      return;
    }

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      setDraft((current) => ({ ...current, name: "", objective: "" }));
      await fetchData();
    } catch {
      setError("Unable to create project.");
    }
  }

  async function patchProject(
    projectId: string,
    patch: Partial<Project> & { status?: Project["status"] },
  ) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchData();
    } catch {
      setError("Unable to update project.");
    }
  }

  async function deleteProject(projectId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("failed");
      }
      await fetchData();
    } catch {
      setError("Unable to delete project.");
    }
  }

  const metrics = useMemo(() => {
    const byProject = new Map<
      string,
      { totalTasks: number; doneTasks: number; docs: number; memories: number }
    >();

    for (const project of projects) {
      byProject.set(project.id, {
        totalTasks: 0,
        doneTasks: 0,
        docs: 0,
        memories: 0,
      });
    }

    for (const task of tasks) {
      if (!task.projectId || !byProject.has(task.projectId)) {
        continue;
      }
      const stats = byProject.get(task.projectId);
      if (!stats) {
        continue;
      }
      stats.totalTasks += 1;
      if (task.column === "done") {
        stats.doneTasks += 1;
      }
    }

    for (const doc of docs) {
      for (const projectId of doc.linkedProjectIds ?? []) {
        const stats = byProject.get(projectId);
        if (stats) {
          stats.docs += 1;
        }
      }
    }

    for (const item of memoryItems) {
      for (const projectId of item.linkedProjectIds ?? []) {
        const stats = byProject.get(projectId);
        if (stats) {
          stats.memories += 1;
        }
      }
    }

    return byProject;
  }, [projects, tasks, docs, memoryItems]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Projects</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Project Command Center
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Track cross-tool progress with linked tasks, docs, and memory evidence.
        </p>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <form
          onSubmit={createProject}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-[2fr_2fr_1fr_1fr_auto]"
        >
          <input
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Project name"
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <input
            value={draft.objective}
            onChange={(event) =>
              setDraft((current) => ({ ...current, objective: event.target.value }))
            }
            placeholder="Objective"
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <select
            value={draft.ownerId}
            onChange={(event) =>
              setDraft((current) => ({ ...current, ownerId: event.target.value }))
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
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value as Project["status"],
              }))
            }
            className="rounded-xl border border-white/10 bg-panel-strong/70 px-3 py-2 text-sm text-slate-100"
          >
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
          <button
            type="submit"
            className="rounded-xl border border-sky-300/30 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/25"
          >
            Add Project
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {loading ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
            Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-slate-500">
            No projects found.
          </div>
        ) : (
          projects.map((project) => {
            const stats = metrics.get(project.id) ?? {
              totalTasks: 0,
              doneTasks: 0,
              docs: 0,
              memories: 0,
            };
            const progress =
              stats.totalTasks > 0
                ? Math.round((stats.doneTasks / stats.totalTasks) * 100)
                : 0;
            const owner = members.find((member) => member.id === project.ownerId);

            return (
              <ProjectCard
                key={`${project.id}-${project.updatedAt}`}
                project={project}
                progress={progress}
                stats={stats}
                ownerName={owner?.displayName ?? project.ownerId}
                members={members}
                onPatch={patchProject}
                onDelete={deleteProject}
              />
            );
          })
        )}
      </section>
    </div>
  );
}

function ProjectCard({
  project,
  progress,
  stats,
  ownerName,
  members,
  onPatch,
  onDelete,
}: {
  project: Project;
  progress: number;
  stats: { totalTasks: number; doneTasks: number; docs: number; memories: number };
  ownerName: string;
  members: TeamMember[];
  onPatch: (
    projectId: string,
    patch: Partial<Project> & { status?: Project["status"] },
  ) => Promise<void>;
  onDelete: (projectId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const [objective, setObjective] = useState(project.objective);
  const [ownerId, setOwnerId] = useState(project.ownerId);
  const [status, setStatus] = useState<Project["status"]>(project.status);

  const statusStyle =
    status === "active"
      ? "bg-emerald-400/15 text-emerald-300"
      : status === "paused"
        ? "bg-amber-400/15 text-amber-300"
        : "bg-sky-400/15 text-sky-200";

  return (
    <article className="rounded-2xl border border-white/10 bg-panel/80 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">{project.name}</h2>
          <p className="mt-1 text-sm text-slate-400">{project.objective || "No objective yet."}</p>
          <p className="mt-2 text-xs text-slate-500">Owner: {ownerName}</p>
        </div>
        <span className={`rounded-md px-2 py-1 text-xs uppercase tracking-[0.12em] ${statusStyle}`}>
          {status}
        </span>
      </div>

      <div className="mt-4">
        <div className="h-2 rounded bg-white/10">
          <div className="h-2 rounded bg-sky-400" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {progress}% complete ({stats.doneTasks}/{stats.totalTasks} tasks)
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
        <span className="rounded-md bg-white/8 px-2 py-1">{stats.docs} docs linked</span>
        <span className="rounded-md bg-white/8 px-2 py-1">{stats.memories} memories linked</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing((value) => !value)}
          className="rounded-md border border-white/15 px-2 py-1 text-xs text-slate-300 hover:bg-white/[0.05]"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          onClick={() => onDelete(project.id)}
          className="rounded-md border border-rose-300/30 px-2 py-1 text-xs text-rose-200 hover:bg-rose-400/15"
        >
          Delete
        </button>
      </div>

      {editing ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void onPatch(project.id, { name, objective, ownerId, status });
            setEditing(false);
          }}
          className="mt-3 space-y-2"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
          />
          <input
            value={objective}
            onChange={(event) => setObjective(event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as Project["status"])}
              className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-slate-100"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
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
    </article>
  );
}
