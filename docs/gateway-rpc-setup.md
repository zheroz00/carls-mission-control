# Gateway WebSocket RPC Integration

## What We Built
Mission Control now connects to the OpenClaw gateway via WebSocket RPC with Ed25519 device authentication. This replaces the previous file-based approach (reading `~/.openclaw/openclaw.json` locally, which doesn't work since the gateway moved to a remote server).

## New Files
- `lib/gateway-rpc.ts` — WebSocket RPC client with v3 device auth (Ed25519 signing)
- `scripts/generate-device-keypair.ts` — One-off keypair generator (already used)

## Modified Files
- `lib/gateway.ts` — Exported `resolveGatewayConfig()` for reuse
- `lib/types.ts` — Added `"gateway-rpc"` to source type unions
- `lib/openclaw.ts` — Team members: tries RPC `agents.list` first, falls back to local config
- `lib/openclaw-schedules.ts` — Cron jobs: tries RPC `cron.list` first, falls back to local file
- `app/calendar/` — Updated source filter types and dropdown to include "Gateway RPC"

## How Auth Works
1. MC connects to `wss://openclaw-carl.tail445e0.ts.net/` with gateway token header
2. Gateway sends a challenge nonce
3. MC builds a v3 payload: `v3|deviceId|cli|cli|operator|operator.read|timestamp|deviceToken|nonce|linux|`
4. MC signs it with Ed25519 private key and sends the connect message
5. Gateway verifies signature against the registered public key

## Env Vars (`.env.local`)
- `OPENCLAW_GATEWAY_URL` — Gateway base URL
- `OPENCLAW_GATEWAY_TOKEN` — Shared gateway token (for WS header)
- `OPENCLAW_DEVICE_PRIVATE_KEY` — Ed25519 private key (PKCS8 DER, base64)
- `OPENCLAW_DEVICE_PUBLIC_KEY` — Ed25519 public key (SPKI DER, base64)
- `OPENCLAW_DEVICE_TOKEN` — Paired device token (rotated on re-pair)

## Device Registration
Device `37c6eb35...` is registered in `~/.openclaw/paired.json` on the remote server with `operator.read` scope. The deviceId is `SHA-256(raw_32byte_public_key)`.

## Key Source Reference
Auth payload format discovered from: `src/gateway/device-auth.ts` in [openclaw/openclaw](https://github.com/openclaw/openclaw)
