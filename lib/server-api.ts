import { headers } from "next/headers";
import type {
  Task,
  Project,
  ActivityEvent,
  CalendarPayload,
  TeamMember,
  TeamOverride,
  MissionProfile,
  DocItem,
  MemoryDay,
  OfficeLayout,
  OfficePresence,
  ReversePromptTemplate,
} from "@/lib/types";

function normalizePath(pathname: string): string {
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

async function resolveBaseUrl(): Promise<string> {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:4237";
}

export async function fetchApi<T>(pathname: string): Promise<T> {
  const response = await fetch(`${await resolveBaseUrl()}${normalizePath(pathname)}`, {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${pathname} (${response.status})`);
  }

  return (await response.json()) as T;
}

/* ── Resource fetchers ─────────────────────────────────────────────── */

export async function fetchTasks() {
  return fetchApi<{ tasks: Task[] }>("/api/tasks");
}

export async function fetchProjects() {
  return fetchApi<{ projects: Project[] }>("/api/projects");
}

export async function fetchActivity() {
  return fetchApi<{
    events: ActivityEvent[];
    gatewayConnected: boolean;
    gatewayEndpoint?: string;
  }>("/api/activity");
}

export async function fetchCalendar() {
  return fetchApi<CalendarPayload>("/api/calendar");
}

export async function fetchTeam() {
  return fetchApi<{
    members: TeamMember[];
    mission: MissionProfile;
    overrides: TeamOverride[];
  }>("/api/team");
}

export async function fetchDocs(query?: string) {
  const qs = query ? `?q=${encodeURIComponent(query)}` : "";
  return fetchApi<{
    docs: DocItem[];
    gatewayConnected: boolean;
    gatewayEndpoint?: string;
    query: string;
  }>(`/api/docs${qs}`);
}

export async function fetchMemory(query?: string, projectId?: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (projectId) params.set("projectId", projectId);
  const qs = params.toString() ? `?${params.toString()}` : "";
  return fetchApi<{
    available: boolean;
    rootPath: string;
    memoryDays: MemoryDay[];
    message?: string;
    query?: string;
    projectId?: string;
  }>(`/api/memory${qs}`);
}

export async function fetchOffice() {
  return fetchApi<{
    layout: OfficeLayout;
    presence: OfficePresence[];
    recentEvents: ActivityEvent[];
    updatedAt: string;
  }>("/api/office");
}

export async function fetchGatewayStatus() {
  return fetchApi<{
    connected: boolean;
    baseUrl: string;
    checkedAt: string;
    details?: string;
  }>("/api/gateway/status");
}

export async function fetchReversePrompts() {
  return fetchApi<{ templates: ReversePromptTemplate[] }>("/api/reverse-prompts");
}
