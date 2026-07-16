# Extension Starter

This directory is the starter template for BuildingAI/EchoFlow extensions. It is not an EchoFlow business plugin and should stay aligned with the root extension rules in `AGENTS.md`.

## Purpose

Use this template as the baseline for a new extension created by the BuildingAI extension tooling. After generation, replace all template identity and example content with the new extension's real metadata, routes, modules, and README.

## Key files to update after generation

- `package.json`
  - `name`, `version`, `description`, `author`, `engine.buildingai`
  - scripts and dependencies used by the generated extension
- `manifest.json`
  - `identifier`, user-facing `name`, `description`, `author`, `engine.buildingai`
- `src/api/index.ts`
  - exports the extension API `AppModule`
- `src/api/modules/app.module.ts`
  - registers extension API modules, entities, providers, and imports
- `src/web/main.tsx`
  - web entrypoint
- `src/web/routes.tsx`
  - `defineRouteOption({ base, identifier, routes, consoleRoutes, consoleMenus })`
- `README.md`
  - replace this template README with plugin-specific facts, including route semantics for the main app user entry, extension bundle/dev base, and console routes

## Required consistency checks

Before shipping a generated extension, verify:

- Directory name, `package.json.name`, `manifest.json.identifier`, route `identifier`, and Vite extension base use the same identifier.
- `manifest.json.version` and `package.json.version` match.
- `manifest.json.engine.buildingai` and `package.json.engine.buildingai` match.
- The extension is registered in `extensions/extensions.json` when it should be available locally.
- Runtime/build/test imports are declared in this extension's own dependencies or devDependencies.
- Generated/runtime directories such as `build`, `.output`, `.temp`, `.nuxt`, and runtime storage are produced by commands, not edited by hand.

## Route terminology

Document generated extension routes with these terms:

- Main-system user entry: `/apps/<identifier>/*` in the host client.
- Extension bundle/local dev base: `/extension/<identifier>/*` from the extension Vite/base config.
- Console routes: state whether a path is the `consoleRoutes` relative route, such as `/console/...`, or the full bundle/dev-base URL, such as `/extension/<identifier>/console/...`.

Do not use `/apps` and `/extension` interchangeably in plugin READMEs or browser QA notes.

## Common commands

Run commands through the extension's own package scripts. Do not assume every extension uses the same typechecker or test runner.

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> test
```

For release readiness, use the project skill/checklist:

```text
/extension-release-check
```

For minimal verification selection, use:

```text
/repo-verify
```

## Documentation responsibility

The generated plugin README should record only plugin-specific facts: product purpose, entry points, modules, data/storage, plugin-specific AI/provider/billing/queue boundaries, verification evidence, known risks, and next steps. Cross-plugin rules belong in root `AGENTS.md`.
