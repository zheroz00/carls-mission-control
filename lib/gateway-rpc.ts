import { createHash, createPrivateKey, createPublicKey, sign } from "node:crypto";
import { resolveGatewayConfig } from "@/lib/gateway";

const RPC_TIMEOUT_MS = 5000;
const HANDSHAKE_TIMEOUT_MS = 8000;
const DEVICE_ROLE = "operator";
const DEVICE_SCOPES = ["operator.read"];
const CLIENT_ID = "cli";
const CLIENT_MODE = "cli";
const CLIENT_PLATFORM = "linux";

// --- Types ---

interface RpcMessage {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: unknown;
  ok?: boolean;
  payload?: unknown;
  error?: string;
  event?: string;
}

export interface RpcAgent {
  id: string;
  model?: string;
  workspace?: string;
  default?: boolean;
  displayName?: string;
  heartbeat?: { every?: string };
}

export interface RpcCronJob {
  id: string;
  name?: string;
  schedule?: string;
  nextRun?: string;
  enabled?: boolean;
  prompt?: string;
}

export interface RpcHeartbeat {
  agentId?: string;
  ts?: string;
  status?: string;
}

// --- Connection state ---

let ws: WebSocket | null = null;
let connected = false;
let connectPromise: Promise<void> | null = null;
let requestCounter = 0;

const pendingRequests = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (err: Error) => void; timer: ReturnType<typeof setTimeout> }
>();

// --- Config ---

function getDeviceConfig() {
  const privKeyB64 = process.env.OPENCLAW_DEVICE_PRIVATE_KEY?.trim();
  const pubKeyB64 = process.env.OPENCLAW_DEVICE_PUBLIC_KEY?.trim();
  const token = process.env.OPENCLAW_DEVICE_TOKEN?.trim() ?? "";
  if (!privKeyB64 || !pubKeyB64) return null;

  const privKey = createPrivateKey({
    key: Buffer.from(privKeyB64, "base64"),
    format: "der",
    type: "pkcs8",
  });
  const pubKey = createPublicKey({
    key: Buffer.from(pubKeyB64, "base64"),
    format: "der",
    type: "spki",
  });
  const pubRaw32 = Buffer.from(pubKey.export({ type: "spki", format: "der" })).subarray(-32);
  const deviceId = createHash("sha256").update(pubRaw32).digest("hex");
  const publicKeyB64url = pubRaw32.toString("base64url");

  return { privKey, deviceId, publicKeyB64url, token };
}

export function isRpcAvailable(): boolean {
  return getDeviceConfig() !== null;
}

// --- Signing (OpenClaw v3 device auth payload) ---

function buildV3Payload(
  deviceId: string,
  token: string,
  nonce: string,
  signedAtMs: number,
): string {
  return [
    "v3",
    deviceId,
    CLIENT_ID,
    CLIENT_MODE,
    DEVICE_ROLE,
    DEVICE_SCOPES.join(","),
    String(signedAtMs),
    token,
    nonce,
    CLIENT_PLATFORM,
    "", // deviceFamily
  ].join("|");
}

function signPayload(payload: string, privKey: ReturnType<typeof createPrivateKey>): string {
  return sign(null, Buffer.from(payload, "utf8"), privKey).toString("base64url");
}

// --- WebSocket connection ---

function nextId(): string {
  return `mc-${++requestCounter}`;
}

function handleMessage(data: string) {
  let msg: RpcMessage;
  try {
    msg = JSON.parse(data) as RpcMessage;
  } catch {
    return;
  }

  if (msg.type === "res" && msg.id) {
    const pending = pendingRequests.get(msg.id);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(msg.id);
      if (msg.ok) {
        pending.resolve(msg.payload);
      } else {
        pending.reject(new Error(msg.error ?? "RPC error"));
      }
    }
  }
}

async function createConnection(): Promise<void> {
  const device = getDeviceConfig();
  if (!device) throw new Error("Device config not available");

  const gateway = await resolveGatewayConfig();
  const wsUrl = gateway.baseUrl.replace(/^http/, "ws");

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Handshake timeout"));
      cleanup();
    }, HANDSHAKE_TIMEOUT_MS);

    const socket = new WebSocket(wsUrl, {
      headers: {
        "x-gateway-token": gateway.token ?? "",
      },
    } as unknown as string[]);

    let handshakeId: string | null = null;

    function cleanup() {
      clearTimeout(timeout);
      try { socket.close(); } catch { /* ignore */ }
      ws = null;
      connected = false;
      connectPromise = null;
    }

    socket.addEventListener("message", (event) => {
      const data = typeof event.data === "string" ? event.data : String(event.data);
      let msg: RpcMessage;
      try {
        msg = JSON.parse(data) as RpcMessage;
      } catch {
        return;
      }

      // Step 1: receive challenge
      if (msg.type === "event" && msg.event === "connect.challenge") {
        const challengePayload = msg.payload as { nonce?: string } | undefined;
        const nonce = challengePayload?.nonce;
        if (!nonce) {
          reject(new Error("No nonce in challenge"));
          cleanup();
          return;
        }

        const signedAt = Date.now();
        const authPayload = buildV3Payload(device.deviceId, device.token, nonce, signedAt);
        const signature = signPayload(authPayload, device.privKey);
        handshakeId = nextId();

        socket.send(JSON.stringify({
          type: "req",
          id: handshakeId,
          method: "connect",
          params: {
            minProtocol: 3,
            maxProtocol: 3,
            client: {
              id: CLIENT_ID,
              version: "mission-control/1.0",
              platform: CLIENT_PLATFORM,
              mode: CLIENT_MODE,
            },
            auth: { token: device.token },
            role: DEVICE_ROLE,
            scopes: DEVICE_SCOPES,
            device: {
              id: device.deviceId,
              publicKey: device.publicKeyB64url,
              nonce,
              signedAt,
              signature,
            },
          },
        }));
        return;
      }

      // Step 2: receive hello-ok
      if (msg.type === "res" && msg.id === handshakeId) {
        clearTimeout(timeout);
        if (msg.ok) {
          ws = socket;
          connected = true;
          console.log("[gateway-rpc] Connected to gateway");
          resolve();
        } else {
          reject(new Error(msg.error ?? "Handshake rejected"));
          cleanup();
        }
        return;
      }

      // After handshake, route to normal handler
      if (connected) {
        handleMessage(data);
      }
    });

    socket.addEventListener("close", () => {
      if (connected) {
        console.log("[gateway-rpc] Connection closed");
      }
      ws = null;
      connected = false;
      connectPromise = null;
      for (const [id, pending] of pendingRequests) {
        clearTimeout(pending.timer);
        pending.reject(new Error("Connection closed"));
        pendingRequests.delete(id);
      }
    });

    socket.addEventListener("error", (err) => {
      if (!connected) {
        reject(new Error(`WebSocket error: ${err}`));
        cleanup();
      }
    });
  });
}

async function getConnection(): Promise<WebSocket> {
  if (ws && connected) return ws;
  if (connectPromise) {
    await connectPromise;
    if (ws) return ws;
  }
  connectPromise = createConnection();
  await connectPromise;
  if (!ws) throw new Error("Failed to establish connection");
  return ws;
}

// --- RPC calls ---

async function sendRequest<T = unknown>(method: string, params?: unknown): Promise<T> {
  const socket = await getConnection();
  const id = nextId();

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`RPC timeout: ${method}`));
    }, RPC_TIMEOUT_MS);

    pendingRequests.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
    });

    socket.send(JSON.stringify({ type: "req", id, method, params }));
  });
}

// --- Exported methods ---

export async function rpcAgentsList(): Promise<RpcAgent[]> {
  const result = await sendRequest<{ agents?: RpcAgent[] } | RpcAgent[]>("agents.list");
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "agents" in result) {
    const agents = (result as { agents: RpcAgent[] }).agents ?? [];
    return Array.isArray(agents) ? agents : [];
  }
  return [];
}

export async function rpcCronList(): Promise<RpcCronJob[]> {
  const result = await sendRequest<{ jobs?: RpcCronJob[] } | RpcCronJob[]>("cron.list");
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "jobs" in result) {
    return (result as { jobs: RpcCronJob[] }).jobs ?? [];
  }
  return [];
}

export async function rpcLastHeartbeat(): Promise<RpcHeartbeat | null> {
  try {
    const result = await sendRequest<RpcHeartbeat>("last-heartbeat");
    return result ?? null;
  } catch {
    return null;
  }
}

export async function rpcConfigGet(path: string): Promise<unknown> {
  return sendRequest("config.get", { path });
}

export function disconnect() {
  if (ws) {
    try { ws.close(); } catch { /* ignore */ }
    ws = null;
    connected = false;
    connectPromise = null;
  }
}
