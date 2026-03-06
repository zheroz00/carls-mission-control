import { readFile } from "node:fs/promises";

const REQUEST_TIMEOUT_MS = 2500;
const DEFAULT_GATEWAY_BASE_URL = "http://localhost:18789";
const DEFAULT_OPENCLAW_CONFIG_PATH =
  process.env.OPENCLAW_CONFIG_PATH ?? "/home/hank/.openclaw/openclaw.json";

interface GatewayCollectionResult<T> {
  items: T[];
  connected: boolean;
  endpoint?: string;
}

interface GatewayStatus {
  connected: boolean;
  baseUrl: string;
  checkedAt: string;
  details?: string;
}

interface GatewayConfig {
  baseUrl: string;
  token?: string;
}

interface OpenClawFileConfig {
  gateway?: {
    port?: number;
    auth?: {
      token?: string;
    };
  };
}

let gatewayConfigCache: GatewayConfig | null = null;

function normalizeGatewayArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const container = payload as Record<string, unknown>;
  const candidateKeys = [
    "data",
    "items",
    "jobs",
    "tasks",
    "documents",
    "results",
    "channels",
    "runs",
  ];

  for (const key of candidateKeys) {
    const value = container[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
}

async function readOpenClawFileConfig(): Promise<OpenClawFileConfig | null> {
  try {
    const raw = await readFile(DEFAULT_OPENCLAW_CONFIG_PATH, "utf8");
    return JSON.parse(raw) as OpenClawFileConfig;
  } catch {
    return null;
  }
}

export async function resolveGatewayConfig(): Promise<GatewayConfig> {
  if (gatewayConfigCache) {
    return gatewayConfigCache;
  }

  const envBaseUrl = process.env.OPENCLAW_GATEWAY_URL?.trim();
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();
  const fileConfig = await readOpenClawFileConfig();
  const filePort = fileConfig?.gateway?.port;
  const fileToken = fileConfig?.gateway?.auth?.token?.trim();

  const baseUrl =
    envBaseUrl && envBaseUrl.length > 0
      ? envBaseUrl
      : typeof filePort === "number"
        ? `http://localhost:${filePort}`
        : DEFAULT_GATEWAY_BASE_URL;

  gatewayConfigCache = {
    baseUrl: baseUrl.replace(/\/$/, ""),
    token: envToken && envToken.length > 0 ? envToken : fileToken,
  };

  return gatewayConfigCache;
}

async function fetchGateway(pathname: string): Promise<Response> {
  const gateway = await resolveGatewayConfig();
  const url = `${gateway.baseUrl}${pathname.startsWith("/") ? "" : "/"}${pathname}`;
  const headers = new Headers({ accept: "application/json" });

  if (gateway.token) {
    headers.set("authorization", `Bearer ${gateway.token}`);
    headers.set("x-gateway-token", gateway.token);
  }

  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
}

function isJsonResponse(response: Response): boolean {
  return (response.headers.get("content-type") ?? "")
    .toLowerCase()
    .includes("application/json");
}

export async function fetchGatewayStatus(): Promise<GatewayStatus> {
  const gateway = await resolveGatewayConfig();
  const checkedAt = new Date().toISOString();
  const candidatePaths = ["/health", "/api/health", "/"];

  for (const candidatePath of candidatePaths) {
    try {
      const response = await fetchGateway(candidatePath);
      if (response.ok || response.status === 401 || response.status === 403) {
        return {
          connected: true,
          baseUrl: gateway.baseUrl,
          checkedAt,
          details: response.ok
            ? `reachable at ${candidatePath}`
            : `reachable at ${candidatePath} (auth required)`,
        };
      }
    } catch {
      // Ignore and try next path.
    }
  }

  return {
    connected: false,
    baseUrl: gateway.baseUrl,
    checkedAt,
    details: "connection failed",
  };
}

export async function fetchGatewayCollection<T>(
  candidatePaths: string[],
): Promise<GatewayCollectionResult<T>> {
  let connected = false;

  for (const candidatePath of candidatePaths) {
    try {
      const response = await fetchGateway(candidatePath);
      if (response.ok || response.status === 401 || response.status === 403) {
        connected = true;
      }

      if (!response.ok || !isJsonResponse(response)) {
        continue;
      }

      const payload = (await response.json()) as unknown;
      const items = normalizeGatewayArray(payload) as T[];
      return { items, connected: true, endpoint: candidatePath };
    } catch {
      // Ignore and continue.
    }
  }

  return { items: [], connected };
}
