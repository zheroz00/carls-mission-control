export type TaskColumn = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskSource = "local" | "gateway";

export interface Task {
  id: string;
  title: string;
  description?: string;
  column: TaskColumn;
  priority: TaskPriority;
  assigneeId: string;
  projectId: string | null;
  createdAt: string;
  updatedAt: string;
  source: TaskSource;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  nextRun: string;
  source: "local" | "gateway" | "openclaw-config" | "gateway-rpc";
  color?: string;
}

export interface ProactiveTask {
  id: string;
  title: string;
  dueAt: string;
  status: "queued" | "active" | "done";
  source: "local" | "gateway";
}

export interface CalendarPayload {
  cronJobs: CronJob[];
  proactiveTasks: ProactiveTask[];
  gatewayConnected: boolean;
  gatewayEndpoint?: string;
}

export interface MemoryItem {
  id: string;
  title: string;
  date: string;
  path: string;
  preview: string;
  content: string;
  linkedProjectIds?: string[];
}

export interface MemoryDay {
  date: string;
  items: MemoryItem[];
}

export interface DocItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  updatedAt: string;
  source: "local" | "gateway";
  path?: string;
  linkedProjectIds?: string[];
}

export type ProjectStatus = "active" | "paused" | "completed";

export interface Project {
  id: string;
  name: string;
  objective: string;
  status: ProjectStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  linkedTaskIds: string[];
  linkedDocIds: string[];
  linkedMemoryIds: string[];
}

export type TeamMemberLevel = "main" | "subagent" | "worker";
export type TeamMemberSource = "config" | "localOverride" | "gateway-rpc";

export interface TeamMember {
  id: string;
  displayName: string;
  role: string;
  model: string;
  workspace: string;
  level: TeamMemberLevel;
  source: TeamMemberSource;
  deviceLabel?: string;
}

export interface TeamOverride {
  id: string;
  displayName?: string;
  role?: string;
  level?: TeamMemberLevel;
  deviceLabel?: string;
}

export interface MissionProfile {
  statement: string;
  updatedAt: string;
  defaultOwnerId: string;
}

export type ActivityKind = "task" | "cron" | "memory" | "docs" | "system";

export interface ActivityEvent {
  id: string;
  ts: string;
  actorId: string;
  kind: ActivityKind;
  message: string;
  metadata?: Record<string, string>;
  source: "local" | "gateway";
}

export type OfficeZone = "desk" | "meeting" | "idle" | "review";
export type OfficePresenceStatus = "active" | "idle" | "offline";

export interface OfficePresence {
  agentId: string;
  zone: OfficeZone;
  status: OfficePresenceStatus;
  taskId?: string;
  updatedAt: string;
}

export interface OfficeLayoutSeat {
  agentId: string;
  x: number;
  y: number;
}

export interface OfficeLayout {
  width: number;
  height: number;
  seats: OfficeLayoutSeat[];
}

export interface ReversePromptTemplate {
  id: string;
  title: string;
  description: string;
  prompt: string;
}
