import { readFile } from "node:fs/promises";
import { isRpcAvailable, rpcCronList } from "@/lib/gateway-rpc";
import { CronJob } from "@/lib/types";

const DEFAULT_OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH ?? "/home/hank/.openclaw/openclaw.json";

interface AgentHeartbeatConfig {
  every?: string;
}

interface AgentEntry {
  id?: string;
  displayName?: string;
  heartbeat?: AgentHeartbeatConfig;
}

interface OpenClawAgentsConfig {
  defaults?: {
    heartbeat?: AgentHeartbeatConfig;
  };
  list?: AgentEntry[];
}

interface OpenClawConfig {
  agents?: OpenClawAgentsConfig;
}

function intervalToCron(interval: string): string | null {
  const match = interval.match(/^(\d+)\s*(m|min|mins|minutes?|h|hr|hrs|hours?)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (unit.startsWith("m")) {
    if (value <= 0 || value > 59) return null;
    return `*/${value} * * * *`;
  }

  if (unit.startsWith("h")) {
    if (value <= 0 || value > 23) return null;
    return `0 */${value} * * *`;
  }

  return null;
}

async function readOpenClawSchedulesFromFile(): Promise<CronJob[]> {
  let config: OpenClawConfig;
  try {
    const raw = await readFile(DEFAULT_OPENCLAW_CONFIG_PATH, "utf8");
    config = JSON.parse(raw) as OpenClawConfig;
  } catch {
    return [];
  }

  const agents = config.agents;
  if (!agents?.list) return [];

  const defaultInterval = agents.defaults?.heartbeat?.every;
  const jobs: CronJob[] = [];

  for (const agent of agents.list) {
    const id = agent.id;
    if (!id) continue;

    const interval = agent.heartbeat?.every ?? defaultInterval;
    if (!interval) continue;

    const schedule = intervalToCron(interval);
    if (!schedule) continue;

    const name = agent.displayName
      ? `${agent.displayName} Heartbeat`
      : `${id} Heartbeat`;

    jobs.push({
      id: `openclaw-heartbeat-${id}`,
      name,
      schedule,
      nextRun: new Date().toISOString(),
      source: "openclaw-config",
    });
  }

  return jobs;
}

async function readOpenClawSchedulesFromRpc(): Promise<CronJob[]> {
  const rpcJobs = await rpcCronList();
  return rpcJobs.map((job) => ({
    id: job.id ?? `rpc-cron-${job.name ?? "unknown"}`,
    name: job.name ?? "Gateway Cron Job",
    schedule: job.schedule ?? "unknown",
    nextRun: job.nextRun ?? new Date().toISOString(),
    source: "gateway-rpc" as const,
  }));
}

export async function readOpenClawSchedules(): Promise<CronJob[]> {
  if (isRpcAvailable()) {
    try {
      return await readOpenClawSchedulesFromRpc();
    } catch (err) {
      console.warn("[openclaw-schedules] RPC failed, falling back to file:", err);
    }
  }
  return readOpenClawSchedulesFromFile();
}
