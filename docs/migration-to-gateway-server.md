# Migrating Mission Control to the Gateway Server

Move Mission Control from hank01 to openclaw-carl so both MC and the OpenClaw gateway run on the same machine.

## Why

MC is a lightweight Next.js dashboard. Running it on the same server as the gateway means:
- No need for remote WebSocket auth to get data (local fallbacks just work)
- One machine to maintain, deploy, and update
- The RPC integration still works and provides live runtime data as the primary source

## Prerequisites

- Node.js 18+ on the target server
- Git access to `https://github.com/zheroz00/carls-mission-control.git`
- The `.env.local` file from the current deployment (contains device keys and tokens)

## Step-by-step

### 1. Clone the repo on openclaw-carl

```bash
ssh openclaw-carl
cd /opt  # or wherever you want it
git clone https://github.com/zheroz00/carls-mission-control.git mission-control
cd mission-control
```

### 2. Copy environment file

From hank01, copy the `.env.local` file:

```bash
# From hank01:
scp /mnt/dockerSSD/git/mission-control/.env.local openclaw-carl:/opt/mission-control/.env.local
```

### 3. Update gateway URL (optional)

Since MC and the gateway are now on the same machine, you can simplify the gateway URL. Edit `.env.local`:

```bash
# Before (remote):
OPENCLAW_GATEWAY_URL=https://openclaw-carl.tail445e0.ts.net

# After (local):
OPENCLAW_GATEWAY_URL=http://localhost:18789
```

This is optional — the Tailscale URL still works, but localhost avoids the network round-trip.

### 4. Copy data files

The `data/` directory contains all persistent state. Copy it from the current server:

```bash
# From hank01:
scp -r /mnt/dockerSSD/git/mission-control/data/ openclaw-carl:/opt/mission-control/data/
```

Files to verify exist:
- `tasks.json`
- `projects.json`
- `activity-events.json`
- `cron-jobs.json`
- `proactive-tasks.json`
- `docs.json`
- `mission.json`
- `office-layout.json`
- `team-overrides.json`

Missing files will be auto-created as empty defaults on first access, so this isn't catastrophic — but you'll lose existing data if you skip this step.

### 5. Install dependencies and build

```bash
npm install
npm run build
```

### 6. Start Mission Control

```bash
# Production mode (port 4237):
npm run start

# Or dev mode:
npm run dev
```

### 7. (Optional) Run as a systemd service

Create `/etc/systemd/system/mission-control.service`:

```ini
[Unit]
Description=Mission Control Dashboard
After=network.target

[Service]
Type=simple
User=hank
WorkingDirectory=/opt/mission-control
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mission-control
```

### 8. Verify

- Open `http://openclaw-carl:4237` (or via Tailscale hostname)
- Check the calendar page — cron jobs should load via RPC
- Check that data from `data/` files is present

### 9. Clean up hank01

Once everything is confirmed working on openclaw-carl:

```bash
# On hank01 — stop the old instance and optionally remove:
# (keep a backup of data/ and .env.local just in case)
cp -r /mnt/dockerSSD/git/mission-control/data/ ~/mc-data-backup/
cp /mnt/dockerSSD/git/mission-control/.env.local ~/mc-env-backup
```

## Updating after migration

On openclaw-carl:

```bash
cd /opt/mission-control
git pull
npm install
npm run build
sudo systemctl restart mission-control  # if using systemd
```

One box, one `git pull`, done.
