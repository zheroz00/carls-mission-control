"use client";

import { useEffect, useMemo, useState } from "react";
import { DocItem, Project } from "@/lib/types";

interface DocsPayload {
  docs: DocItem[];
  query: string;
  gatewayConnected: boolean;
  gatewayEndpoint?: string;
}

interface ProjectsPayload {
  projects: Project[];
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

export default function DocsPage() {
  const [docsPayload, setDocsPayload] = useState<DocsPayload>({
    docs: [],
    query: "",
    gatewayConnected: false,
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchData(qValue: string, projectIdValue: string) {
    const q = qValue.trim();
    const selectedProjectId = projectIdValue.trim();
    const searchParams = new URLSearchParams();
    if (q.length > 0) {
      searchParams.set("q", q);
    }
    if (selectedProjectId.length > 0) {
      searchParams.set("projectId", selectedProjectId);
    }

    const suffix = searchParams.toString();
    const docsPath = `/api/docs${suffix ? `?${suffix}` : ""}`;

    try {
      const [docsRes, projectsRes] = await Promise.all([
        fetch(docsPath),
        fetch("/api/projects"),
      ]);
      const docsResponse = (await docsRes.json()) as DocsPayload;
      const projectsResponse = (await projectsRes.json()) as ProjectsPayload;
      setDocsPayload(docsResponse);
      setProjects(projectsResponse.projects ?? []);
      setError("");
    } catch (fetchError) {
      console.error(fetchError);
      setError("Unable to load docs.");
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-panel/85 p-6">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Documentation</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-100">
          Search Docs
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-400">
          <span>{docsPayload.docs.length} results</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
              docsPayload.gatewayConnected
                ? "bg-emerald-400/15 text-emerald-300"
                : "bg-slate-500/20 text-slate-300"
            }`}
          >
            {docsPayload.gatewayConnected ? "Gateway Docs" : "Local Docs"}
          </span>
          {docsPayload.gatewayEndpoint ? (
            <span>Endpoint: {docsPayload.gatewayEndpoint}</span>
          ) : null}
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
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search title, content, tags, path..."
            className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-panel-strong/75 px-3 py-2 text-sm text-slate-100 outline-none ring-sky-300/30 transition placeholder:text-slate-500 focus:ring-2"
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
          {(query.length > 0 || projectId.length > 0) && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setProjectId("");
                void fetchData("", "");
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.07]"
            >
              Clear
            </button>
          )}
        </form>
      </section>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <section className="space-y-3">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-panel/60 px-6 py-12 text-center text-slate-400">
            Loading docs...
          </div>
        ) : docsPayload.docs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-panel/60 px-6 py-12 text-center text-slate-400">
            No docs found.
          </div>
        ) : (
          docsPayload.docs.map((doc) => (
            <article key={doc.id} className="rounded-2xl border border-white/10 bg-panel/75 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-medium text-slate-100">{doc.title}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Updated {formatTimestamp(doc.updatedAt)}
                  </p>
                </div>
                <span
                  className={`rounded-md px-2 py-1 text-xs uppercase tracking-[0.12em] ${
                    doc.source === "gateway"
                      ? "bg-sky-400/15 text-sky-200"
                      : "bg-white/8 text-slate-300"
                  }`}
                >
                  {doc.source}
                </span>
              </div>
              {doc.path ? <p className="mt-2 text-xs text-slate-500">{doc.path}</p> : null}
              <p className="mt-3 text-sm text-slate-300">{doc.content}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {doc.tags.map((tag) => (
                  <span
                    key={`${doc.id}-${tag}`}
                    className="rounded-md bg-white/8 px-2 py-1 text-xs text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
                {(doc.linkedProjectIds ?? []).map((id) => (
                  <span
                    key={`${doc.id}-project-${id}`}
                    className="rounded-md bg-sky-400/10 px-2 py-1 text-xs text-sky-200"
                  >
                    {projectNames.get(id) ?? id}
                  </span>
                ))}
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
