---
name: extension-release-check
description: User-invoked EchoFlow extension release and delivery checklist. Checks manifest/package/extensions.json consistency, scripts, dependencies, build/test commands, README state, release allowlist, and artifact boundaries before shipping an extension.
disable-model-invocation: true
---

# Extension Release Check

Use this skill when the user asks to prepare, validate, package, release, or hand off an EchoFlow extension under `extensions/<identifier>/`.

This skill is intentionally user-invoked because it may recommend heavier build/test commands or release packaging.

## Required input

Ask for the target extension identifier if it is not obvious from the current task or changed files.

Examples:

- `echoflow-image`
- `echoflow-video`
- `echoflow-contract-generation`
- `echoflow-astrology-fortune`
- `echoflow-ai-town`

## Source routing

For the target extension, read/check:

- `AGENTS.md` for global extension, security, release, and documentation invariants.
- `extensions/<identifier>/README.md` for plugin-specific facts and verification evidence.
- `extensions/<identifier>/manifest.json`.
- `extensions/<identifier>/package.json`.
- `extensions/extensions.json`.
- `packages/cli/src/commands/extension.js` for the actual `extension:release` copy allowlist.
- Relevant `src/api/**`, `src/web/**`, `vite.config.*`, `tsup.config.ts`, tests, migrations, and upgrade files when changed.

Do not assume generated build outputs or release zips are documentation sources.

## Checklist

### 1. Metadata consistency

Check these files together:

- `extensions/<identifier>/manifest.json`
- `extensions/<identifier>/package.json`
- `extensions/extensions.json`

Verify:

- Directory name, `manifest.json.identifier`, `package.json.name`, `defineRouteOption({ identifier/base })`, and `defineExtensionViteConfig(packageJson)` use the same identifier.
- `manifest.json.version`, `package.json.version`, and `extensions/extensions.json` version match.
- `manifest.json.engine.buildingai` and `package.json.engine.buildingai` match.
- User-facing `name`, `icon`, `author.name`, and `author.avatar` match between manifest and registration.
- `installedAt` in `extensions/extensions.json` is a real ISO timestamp, not a placeholder.
- When an installed runtime is part of the release check, compare its API response or persisted `extension` record with the files. Existing records are not refreshed by editing a same-version upgrade; use an explicit local sync before launch or a new versioned upgrade after release.

### 2. Dependency and script boundaries

Check the extension `package.json`:

- Runtime imports in `src/**/*`, scripts, tests, `vite.config.*`, `tsup.config.*`, and `eslint.config.*` are declared in this extension's dependencies or devDependencies.
- Shared versions use `catalog:api`, `catalog:dev`, or `catalog:web` when the dependency is common.
- `build:publish` directly chains tools and does not nest `pnpm run`.
- CLI tools are called by package name (`vite`, `tsup`, `vue-tsc`, `tsc`, `jest`, `rimraf`) rather than `node ../../node_modules/...` or another workspace package's `node_modules`.
- `format` / `lint:fix` are not used as release validation unless the user explicitly requests mutating cleanup.

### 3. API and web boundaries

Review extension code for global rules:

- API entry exports the plugin module from `src/api/index.ts`.
- Runtime loading will import `build/index.js`; source-only API changes need an API build for runtime validation.
- Plugin entities use `@ExtensionEntity()` and extension schema boundaries.
- Web and Console controllers use extension decorators.
- Frontend HTTP uses `createPluginHttpClients()` instead of hand-built `/extension/{id}` / `/api` / `/consoleapi` prefixes.
- External provider HTTP and public downloads reuse `@buildingai/extension-sdk` helpers when applicable.
- DTO fields have class-validator bounds; URL fields require `http`/`https` and a protocol.
- Public serializers whitelist user-facing fields and do not leak Secret, provider, raw request/response, queue, or billing internals.

### 4. README and long-term facts

Check `extensions/<identifier>/README.md`:

- Product purpose, entry points, API/web modules, plugin-specific technical boundaries, verification commands, known risks, and next steps are current.
- Completed plan items are moved into current capability/verification or removed from next steps.
- Historical verification keeps the Runtime versions that were actually used. Determine the current baseline from root `.nvmrc`, root `package.json.packageManager`, and the target package engines; never hardcode a pnpm or Node version as inherently old or current.
- Generic global rules are referenced through `AGENTS.md` instead of copied in full.
- Temporary docs are not treated as long-term facts.

### 5. Verification commands

Recommend the smallest relevant set first:

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> test
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:api
```

For publish readiness, when scripts exist and the user confirms heavier validation:

```bash
pnpm --filter <identifier> build:publish
```

For `echoflow-video` E2E, only run when the app and credentials are ready:

```bash
BASE_URL=... ADMIN_AUTH_TOKEN=... WEB_USER_AUTH_TOKEN=... pnpm --filter echoflow-video test:e2e
```

### 6. Artifact and release boundaries

Do not hand-edit:

- `build/**`
- `.output/**`
- `.nuxt/**`
- `.temp/**`
- release zips
- runtime uploads/storage

`pnpm extension:release` copies only the allowlist in `packages/cli/src/commands/extension.js`. Do not use `package.json.files` as the release package truth.

If artifacts changed, explain which command generated them and whether they should be committed.

## Output format

Return:

1. Extension identifier.
2. Metadata consistency result.
3. Script/dependency findings.
4. Boundary/security findings.
5. README/doc state.
6. Verification commands run or recommended.
7. Release allowlist/artifact notes.
8. Remaining release blockers.
