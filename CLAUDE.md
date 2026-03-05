# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tools
vte: Visual Tree Explorer. This allows you to explore code much faster and with more in-depth information than traditional tools. Let me know if you like it once you've tried it.

## Development Commands

```bash
npm run dev          # Start dev server on port 4237
npm run build        # Production build
npm run start        # Production server on port 4237
npm run lint         # ESLint (flat config, ESLint 9)
```

## Code Structure & File Organization

### No Monolithic Files
- **Never** create large, all-in-one files. If a file exceeds ~200–300 lines, it is a signal to decompose it.
- Each file must have a **single, clear responsibility** (Single Responsibility Principle). One component, one class, one utility module — not multiple.
- Split logic by concern: separate routes, controllers, services, utilities, models, hooks, and components into their own files.

### Folder Structure
- Organize by **feature or domain** first, then by type (e.g., `/features/auth/`, `/features/dashboard/`), not flat folders of `/controllers/`, `/models/`, etc. unless the project is very small.
- Group related files together. A component and its styles, tests, and types should live in the same folder.
- Follow this hierarchy as a baseline:

src/
├── features/ # Domain-specific logic (auth, user, dashboard, etc.)
├── components/ # Shared/reusable UI components
├── services/ # External API calls, data fetching
├── utils/ # Pure utility/helper functions
├── hooks/ # Custom React hooks (if applicable)
├── types/ # Shared TypeScript interfaces/types
└── config/ # App configuration and constants


### Splitting Rules
- If a function or class is reused in more than one place, extract it to a shared utility or service file immediately.
- If a file imports from more than ~5–7 unrelated modules, it is doing too much — refactor.
- Avoid barrel files (`index.ts`) that re-export everything from dozens of modules, as they obscure dependencies.
- When adding new functionality, **create a new file** rather than appending to an existing one.

### Naming Conventions
- File names must clearly reflect their contents: `userService.ts`, `AuthButton.tsx`, `formatDate.ts`.
- No generic names like `helpers.ts`, `utils.js`, or `misc.ts` — these become dumping grounds.
- Use consistent casing: `PascalCase` for components/classes, `camelCase` for utilities/hooks/services.

### Ongoing Hygiene
- Remove dead/unused code immediately — do not comment it out and leave it.
- If refactoring an existing file causes it to grow significantly, stop and split before continuing.
- Never place configuration, business logic, and UI rendering in the same file.


No test framework is currently configured.

## Architecture

**Mission Control** is a Next.js 16 App Router dashboard for managing tasks, projects, calendar/cron jobs, team members, documentation, memory/journal entries, and office presence visualization.

### Data Layer

All data persists as JSON files in `data/`. The `lib/data.ts` module provides `readJsonFile(fileName, fallback)` and `writeJsonFile(fileName, value)` — on read failure, the fallback value is written and returned.

Data files: `tasks.json`, `projects.json`, `activity-events.json`, `cron-jobs.json`, `proactive-tasks.json`, `docs.json`, `mission.json`, `office-layout.json`, `team-overrides.json`.

Each resource type has a dedicated store module in `lib/` (e.g., `task-store.ts`, `project-store.ts`, `activity-store.ts`, `office-store.ts`) that handles CRUD operations and data normalization.

### Hybrid Local + Gateway Model

Entities carry a `source: "local" | "gateway"` field. The app works standalone with local JSON files, but optionally connects to an OpenClaw gateway (configured in `lib/gateway.ts` and `lib/openclaw.ts`). Gateway URL defaults to `http://localhost:18789`, configurable via `OPENCLAW_GATEWAY_URL` env var. Gateway config is read from `~/.openclaw/openclaw.json`. Local data takes priority; gateway data supplements it. Results are deduplicated by ID.

### API Routes

REST API routes live in `app/api/`. Each resource has standard GET/POST/PUT/DELETE handlers. Dynamic routes use `[id]` segments with `context.params: Promise<{ id: string }>` (must be awaited). All routes use `export const dynamic = "force-dynamic"` and `export const runtime = "nodejs"`.

Activity changes are published via `lib/activity-bus.ts` (in-memory pub/sub) and streamed through `app/api/activity/stream/route.ts` (SSE). Activity store caps at 400 events.

### Pages

Each page in `app/` fetches data server-side using `lib/server-api.ts` (which calls back to the app's own API routes). Pages are server components; interactive parts use `"use client"` directive.

The memory page scans `~/.openclaw/workspace/main/memory/` for markdown, text, JSON, and YAML files, grouped by date.

### Component Organization

Shared components live in `components/` at the project root. Page-specific components are co-located in feature folders (e.g., `app/calendar/components/`).

## Conventions

- **TypeScript strict mode** — all types in `lib/types.ts`
- **Path alias**: `@/*` maps to project root
- **Styling**: Tailwind CSS 4 with dark-only theme. CSS variables defined in `app/globals.css` (`--background`, `--panel`, `--accent`, etc.). Glass effect pattern: `border-white/10 bg-white/[0.02] backdrop-blur-xl`. Accent color is sky-blue (`--accent: #38bdf8`).
- **Fonts**: Space Grotesk (sans), JetBrains Mono (mono) — loaded via `next/font/google`
- **ID generation**: `makeId(prefix)` in `lib/model-utils.ts` — timestamp + random suffix
- **Normalization**: `normalizeTask()`, `normalizeProject()`, `normalizeActivityEvent()` in `lib/model-utils.ts` validate and apply defaults before storage
