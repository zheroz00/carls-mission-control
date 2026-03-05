"use client";

import { useEffect, useMemo, useState } from "react";
import { MemoryDay, Project } from "@/lib/types";

interface MemoryPayload {
  available: boolean;
  rootPath: string;
  memoryDays: MemoryDay[];
  message?: string;
}

interface ProjectsPayload {
  projects: Project[];
}

export default function MemoryPage() {
  const [memory, setMemory] = useState<MemoryPayload>({
    available: false,
    rootPath: "",
    memoryDays: [],
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData(qValue: string, selectedProjectId: string) {
    const q = qValue;

    const searchParams = new URLSearchParams();
    if (q.trim().length > 0) {
      searchParams.set("q", q.trim());
    }
    if (selectedProjectId.trim().length > 0) {
      searchParams.set("projectId", selectedProjectId.trim());
    }
    const suffix = searchParams.toString();
    const memoryPath = `/api/memory${suffix ? `?${suffix}` : ""}`;

    try {
      const [memoryRes, projectsRes] = await Promise.all([
        fetch(memoryPath),
        fetch("/api/projects"),
      ]);
      const memoryPayload = (await memoryRes.json()) as MemoryPayload;
      const projectsPayload = (await projectsRes.json()) as ProjectsPayload;
      setMemory(memoryPayload);
      setProjects(projectsPayload.projects ?? []);
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load memory data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData("", "");
  }, []);

  const projectNames = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects],
  );

  const totalItems = memory.memoryDays.reduce(
    (count, day) => count + day.items.length,
    0,
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Memory</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Daily Memory Stream
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span>{memory.memoryDays.length} days indexed</span>
          <span>{totalItems} entries</span>
          {memory.rootPath ? <span>Root: {memory.rootPath}</span> : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-panel/80 p-4">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void fetchData(query, projectId);
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search memory title, preview, path..."
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-panel-strong/75 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-sky-300/30"
          />
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className="rounded-xl border border-white/10 bg-panel-strong/75 px-3 py-2 text-sm text-slate-100"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl border border-sky-300/30 bg-sky-400/15 px-4 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-400/20"
          >
            Search
          </button>
        </form>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {!memory.available ? (
        <section className="rounded-2xl border border-dashed border-white/10 bg-panel/60 px-6 py-12 text-center text-slate-400">
          {loading ? "Loading memory..." : memory.message ?? "No memory files found."}
        </section>
      ) : (
        <section className="space-y-4">
          {memory.memoryDays.map((day) => (
            <article key={day.date} className="rounded-2xl border border-white/10 bg-panel/75 p-4">
              <header className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-300">
                  {day.date}
                </h2>
                <span className="rounded-md bg-white/8 px-2 py-1 text-xs text-slate-300">
                  {day.items.length}
                </span>
              </header>
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {day.items.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-white/10 bg-panel-strong/70 p-3"
                  >
                    <p className="text-sm font-medium text-slate-100">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.path}</p>
                    <p className="mt-3 text-sm text-slate-400">{item.preview}</p>
                    {(item.linkedProjectIds ?? []).length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(item.linkedProjectIds ?? []).map((id) => (
                          <span
                            key={`${item.id}-${id}`}
                            className="rounded-md bg-sky-400/10 px-2 py-1 text-xs text-sky-200"
                          >
                            {projectNames.get(id) ?? id}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
