---
name: repo-verify
description: BuildingAI/EchoFlow path-aware verification workflow for cross-package changes, root configuration, unclear verification scope, or an explicit user request. Single-package localized changes should use that package's scripts and Stop hints directly.
---

# Repo Verify

Use this skill for cross-package changes, root configuration, unclear verification scope, or when the user asks what to verify. For a localized single-package change, use that package's `package.json` scripts and deterministic Stop hints directly instead of loading this workflow.

## Goals

- Choose the smallest relevant validation commands from the changed paths.
- Avoid full-repo checks unless the change touches shared configuration or cross-cutting code.
- Do not run mutating commands (`format`, `lint:fix`, install, Docker lifecycle, PM2 lifecycle, DB writes) unless the user explicitly asks.
- Include documentation follow-up when a change affects long-lived project, package, skill, or plugin facts.
- Keep verification evidence honest: report exact commands run, failures, skipped checks, and blockers.

## Source routing

Before recommending commands, route by touched paths:

| Changed paths | Read/check |
|---|---|
| `AGENTS.md`, `CLAUDE.md` | Ensure routing remains short and points to the right facts; do not create a second authority source. |
| `packages/api/**` | `packages/api/ai-rules.md`, target module files, API `package.json`. |
| `packages/client/**` | `packages/client/README.md`, `packages/client/package.json`, relevant router/page files. |
| `packages/core/**`, `packages/@buildingai/<pkg>/**` | Nearest package `package.json`, README, `src/index.ts` or export map. Do not derive filesystem paths from package names. |
| `packages/@buildingai/extension-sdk/**` | `packages/@buildingai/extension-sdk/README.md`, `src/index.ts`, `src/tsup.ts`, relevant tests. |
| `extensions/<identifier>/**` | Plugin README, `package.json`, `manifest.json`, and `extensions/extensions.json` if metadata changed. |
| `skills/**` | `skills/README.md`, target `SKILL.md`, and `scripts/sync-skills.mjs`; sync generated copies only when needed. |
| `.agents/**`, `.claude/**`, `.mcp.json` | `AGENTS.md` / `CLAUDE.md` routing and the actual generated skills, config, or hook scripts. |

Layered docs are not automatically read by every agent. If a verification recommendation relies on a plugin README, package README, skill, or subagent prompt, name that file explicitly.

## Workflow

1. Inspect the current diff or changed files.
2. Classify each path by area: API, client, shared package, extension, root config, docs/skills, Claude config.
3. Recommend the minimal command set below.
4. If executing commands, run narrow commands first and report exact pass/fail output.
5. Before handoff, state whether `AGENTS.md`, `CLAUDE.md`, a package README, a skill, or an extension README needed updating.

## Command matrix

| Changed paths | Recommended commands |
|---|---|
| `packages/api/**` | `pnpm --filter @buildingai/api check-types`; `pnpm --filter @buildingai/api lint`; targeted `pnpm --filter @buildingai/api test` when tests or behavior changed |
| `packages/client/**` | `pnpm -C packages/client lint`; `pnpm -C packages/client build:web` when Vite, routing, UI runtime, assets, or build config changed |
| `packages/core/**`, `packages/@buildingai/<pkg>/**` | Read the nearest `package.json` name/scripts, then run its narrow `check-types`, targeted `test`, and `build` when exports/build config changed |
| `extensions/<identifier>/src/api/**` | `pnpm --filter <identifier> check-types`; `pnpm --filter <identifier> test`; `pnpm --filter <identifier> build:api` when API build/export changed |
| `extensions/<identifier>/src/web/**` | `pnpm --filter <identifier> check-types`; `pnpm --filter <identifier> test`; `pnpm --filter <identifier> build:web` when UI/build changed |
| `extensions/<identifier>/manifest.json`, `package.json`, `vite.config.*`, `tsup.config.*` | `check-types`, `test`, relevant `build:web`/`build:api`, and consider `/extension-release-check` |
| `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `pnpm-lock.yaml` | `pnpm typecheck`; `pnpm lint`; explain dependency/workspace impact before install or lockfile changes |
| `AGENTS.md`, `CLAUDE.md`, `skills/**`, README-only changes | Usually no product build; validate paths, versions, script names, routing, and generated skill copies if applicable |
| `docs/troubleshooting/**` | Validate referenced log paths and commands against current config; no product build for documentation-only changes |
| `.claude/settings.json`, `.mcp.json`, hook/MCP scripts | JSON parse config files; run targeted node syntax or simulated hook checks when the script changed |

## E2E and browser notes

- `extensions/echoflow-video` Playwright e2e requires `BASE_URL`, `ADMIN_AUTH_TOKEN`, and `WEB_USER_AUTH_TOKEN`.
- Use Playwright MCP for browser smoke checks only after starting the relevant target from `.claude/launch.json` or the package's own scripts.
- In WSL, this project keeps Playwright MCP opt-in; confirm browser/CDP readiness before browser QA.
- Keep browser/e2e checks separate from unit checks unless credentials and services are ready.
- For “service is healthy but the workflow fails”, inspect persisted API logs before browser automation. A real external model smoke must be explicitly authorized because it may consume credentials or billing.

## Commands to avoid unless explicitly requested

- `pnpm format`
- `pnpm lint:fix`
- `pnpm install`, `pnpm add`, `pnpm remove`
- Full `pnpm build` after small localized edits
- Docker/PM2 lifecycle commands
- Database writes or migrations against a live DB

## Handoff checklist

Report:

- Changed area and why the selected commands were sufficient.
- Commands run and exact result.
- Commands skipped and why.
- Whether `AGENTS.md`, `CLAUDE.md`, package README, skill docs, or plugin README needed updates.
- Whether generated editor skill copies needed sync.
- Remaining blockers, especially missing env vars, auth tokens, Docker services, DB, Redis, browser/CDP, or upstream configuration.
