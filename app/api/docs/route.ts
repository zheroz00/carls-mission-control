import { readJsonFile } from "@/lib/data";
import { fetchGatewayCollection } from "@/lib/gateway";
import { readProjects } from "@/lib/project-store";
import { DocItem } from "@/lib/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_DOCS: DocItem[] = [];

function asString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
}

function normalizeDoc(input: unknown, source: "local" | "gateway"): DocItem | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const raw = input as Record<string, unknown>;
  const title = asString(raw.title ?? raw.name, "Untitled Document");
  const content = asString(raw.content ?? raw.body ?? raw.summary, "");
  const updatedAt = asString(raw.updatedAt ?? raw.updated_at ?? raw.createdAt, new Date().toISOString());
  const path = raw.path ? String(raw.path) : raw.filePath ? String(raw.filePath) : undefined;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.map((tag) => String(tag))
    : typeof raw.tags === "string"
      ? raw.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

  const id = asString(raw.id, `${source}-${title}-${updatedAt}`.toLowerCase().replace(/\s+/g, "-"));

  return {
    id,
    title,
    content,
    tags,
    updatedAt,
    source,
    path,
  };
}

function matchesQuery(doc: DocItem, query: string): boolean {
  if (query.length === 0) {
    return true;
  }

  const haystack = [doc.title, doc.content, doc.tags.join(" "), doc.path ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

function dedupeById(items: DocItem[]): DocItem[] {
  const seen = new Set<string>();
  const deduped: DocItem[] = [];

  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    deduped.push(item);
  }

  return deduped;
}

function detectLinkedProjects(doc: DocItem, projects: { id: string; name: string }[]): string[] {
  if (projects.length === 0) {
    return [];
  }

  const haystack = `${doc.title} ${doc.content} ${doc.path ?? ""}`.toLowerCase();
  return projects
    .filter((project) => haystack.includes(project.name.toLowerCase()))
    .map((project) => project.id);
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const q = (searchParams.get("q") ?? "").trim();
  const projectId = (searchParams.get("projectId") ?? "").trim();

  const [localDocsRaw, gatewayDocsResult, projects] = await Promise.all([
    readJsonFile<DocItem[]>("docs.json", DEFAULT_DOCS),
    fetchGatewayCollection<unknown>([
      "/api/docs",
      "/api/documents",
      "/documents",
      "/docs",
    ]),
    readProjects(),
  ]);

  const localDocs = localDocsRaw
    .map((item) => normalizeDoc(item, "local"))
    .filter((item): item is DocItem => Boolean(item));

  const gatewayDocs = gatewayDocsResult.items
    .map((item) => normalizeDoc(item, "gateway"))
    .filter((item): item is DocItem => Boolean(item));

  const docs = dedupeById([...localDocs, ...gatewayDocs])
    .map((doc) => ({
      ...doc,
      linkedProjectIds: detectLinkedProjects(doc, projects),
    }))
    .filter((doc) => (projectId.length > 0 ? doc.linkedProjectIds?.includes(projectId) : true))
    .filter((doc) => matchesQuery(doc, q))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return NextResponse.json({
    docs,
    gatewayConnected: gatewayDocsResult.connected,
    gatewayEndpoint: gatewayDocsResult.endpoint,
    query: q,
  });
}
