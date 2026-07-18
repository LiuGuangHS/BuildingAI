---
name: project-architecture
description: BuildingAI monorepo navigation and source-of-truth guide. Use when locating code, understanding package boundaries, identifying plugin entry points, or deciding which docs and package manifests to read before a change.
---

# BuildingAI Project Architecture

Use this skill to navigate the BuildingAI/EchoFlow monorepo. Treat machine-readable config and source files as authority for what the system actually does.

## Source-of-truth order

1. Machine config: `package.json`, `.nvmrc`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`, `extensions/extensions.json`, package/plugin `package.json`, plugin `manifest.json`.
2. Source code entry points: API startup, extension loader, SDK exports, routing/build helpers.
3. Repository rules: `AGENTS.md` for cross-repo rules and `CLAUDE.md` for Claude Code routing.
4. Plugin facts: `extensions/<identifier>/README.md` for plugin-specific behavior and verification evidence.
5. Package READMEs: package-local references only; do not let them override code/package exports.

## Workspace shape

The workspace membership is defined by `pnpm-workspace.yaml`:

```text
packages/*
extensions/*
packages/@buildingai/*
packages/@buildingai/web/*
```

Do not rely on a hardcoded package tree when precision matters. Read `pnpm-workspace.yaml` and the relevant directory's `package.json`.

Pnpm dependency governance lives in `pnpm-workspace.yaml`: `catalog`, `catalogs`, `overrides`, `peerDependencyRules`, and `onlyBuiltDependencies`. Do not treat root `package.json` top-level `overrides` as a pnpm source of truth.

## Main applications

- `packages/api/`: NestJS API application.
  - Startup: `packages/api/src/main.ts`
  - Dynamic app module: `packages/api/src/modules/app.module.ts`
  - Important domains: AI, auth, extension, finance, membership, notification, upload, secret, user.
- `packages/client/`: React 19 + Vite 8 + Tauri client.
  - Entry: `packages/client/src/main.tsx`
  - Router: `packages/client/src/router/index.tsx`
  - Main extension host route: `/apps/:identifier/*`.
- `packages/cli/`: BuildingAI CLI and extension create/release tooling.
  - Extension commands and release allowlist: `packages/cli/src/commands/extension.js`.

## Shared packages

Shared package names commonly use the `@buildingai/*` scope, but their filesystem paths are not uniform. Read the nearest `package.json` instead of deriving a path from the package name. Most live under `packages/@buildingai/*` or `packages/@buildingai/web/*`; the platform core package is at `packages/core/`.

- `@buildingai/core` (`packages/core/`): platform modules and extension decorators.
- `@buildingai/db`: TypeORM entities, migrations, seeds, database helpers.
- `@buildingai/extension-sdk`: extension-facing AI, billing, notification, rate limit, provider, URL, download, and build helpers.
- `@buildingai/base`, `@buildingai/decorators`, `@buildingai/dto`, `@buildingai/errors`, `@buildingai/pipe`, `@buildingai/utils`.
- Frontend shared packages under `packages/@buildingai/web/*`: `core`, `http`, `i18n`, `hooks`, `services`, `stores`, `types`, `ui`.

Important source files:

- `packages/@buildingai/extension-sdk/src/index.ts`: public SDK exports.
- `packages/@buildingai/extension-sdk/src/tsup.ts`: extension API build helper defaults.
- `packages/@buildingai/web/core/src/defineRouteOption.tsx`: extension router wrapper.
- `packages/@buildingai/web/core/src/vite/defineExtensionViteConfig.ts`: extension Vite base/output helper.
- `packages/@buildingai/web/services/src/base.ts`: plugin Web/Console HTTP clients.

## Extension system

Extension registry:

- `extensions/extensions.json`

Business plugins currently live under `extensions/echoflow-*`. `extensions/simple-blog/` is a disabled example plugin; `templates/extension-starter/` is the starter template.

Typical extension structure:

```text
extensions/<identifier>/
├── manifest.json
├── package.json
├── README.md
├── src/api/index.ts
├── src/api/modules/app.module.ts
├── src/api/db/entities/
├── src/api/db/migrations/
├── src/api/upgrade/<version>/
├── src/web/main.tsx
├── src/web/routes.tsx
├── vite.config.*
└── tsup.config.ts
```

Runtime loading imports built backend output from `extensions/<identifier>/build/index.js`, so source changes require an API build before runtime install/load validation.

## Common navigation routes

| Task | Start with |
|---|---|
| API feature or bug | `packages/api/src/modules/<domain>/`, then `packages/api/ai-rules.md` if API conventions matter |
| Client route/UI | `packages/client/src/router/index.tsx`, then `packages/client/src/pages/` or shared UI package |
| Main runtime starts but a feature fails | `docs/troubleshooting/main-runtime.md`, persisted API logs, then the affected API/Client source path |
| Extension feature | `extensions/<identifier>/README.md`, `package.json`, `manifest.json`, then `src/api` or `src/web` |
| Extension release | `skills/extension-release-check/SKILL.md`, plugin metadata, `packages/cli/src/commands/extension.js` |
| Verification choice | `skills/repo-verify/SKILL.md` |
| SDK/export change | package `src/index.ts`, `package.json.exports`, build config, consuming plugins/tests |
| Workspace/dependency change | `pnpm-workspace.yaml` for pnpm catalogs/overrides/policies, root `package.json` for packageManager/scripts, lockfile impact |

## Commands and validation

Use `skills/repo-verify/SKILL.md` to choose the smallest relevant validation. Do not default to install, format fixers, Docker/PM2 lifecycle, or database writes.

Common shapes:

```bash
pnpm --filter @buildingai/api check-types
pnpm -C packages/client lint
pnpm --filter @buildingai/<pkg> check-types
pnpm --filter <identifier> check-types
pnpm --filter <identifier> test
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
```

Always check the target package's own `package.json`; extension scripts differ.

## Runtime diagnosis order

When the main system starts successfully but a user workflow fails, avoid broad rollback guesses. Read persisted logs first, identify the final endpoint/status/error category, then compare the affected code with upstream and only after that test Runtime, dependency, Docker, or browser hypotheses. Treat credential errors as configuration failures unless source evidence shows the credential was transformed incorrectly.
