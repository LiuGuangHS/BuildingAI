# EchoFlow BuildingAI Agent Guide

This repository is an EchoFlow extension workspace and second development branch based on BuildingAI. This file is the authoritative source for long-lived cross-extension and cross-system rules. Plugin-specific facts belong in `extensions/<identifier>/README.md`. Do not treat temporary plans, screenshots, QA checklists, or one-off analyses as long-lived sources of truth.

## 1. Source-of-Truth Order

1. Machine facts: `package.json`, `.nvmrc`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`, `docker-compose.yml`, `ecosystem.config.js`, `extensions/extensions.json`, and each plugin's `package.json` / `manifest.json`.
2. Source-code facts: API startup, extension loader, SDK exports, frontend routing/build helpers, and other actual runtime code.
3. This file: cross-repository boundaries, security, verification, and documentation governance.
4. Plugin README files: plugin-specific product goals, entry points, boundaries, verification evidence, risks, and next steps.
5. Package README files and skills: package APIs or workflow guidance; they must not override the sources above.

Layered documentation is not automatically read by every agent. When details are moved into a skill, subagent, or README, the relevant entry point must explicitly route agents to it.

## 2. Task Routing

| Task | Read / invoke |
|---|---|
| Cross-repository rules, architecture, or boundaries | `AGENTS.md`, `CLAUDE.md` |
| API / auth / Secret / upload / queue / billing / DB | `packages/api/ai-rules.md`, relevant source, relevant tests, and ECC security review when applicable |
| Client | `packages/client/README.md`, `packages/client/package.json`, relevant route/page |
| Shared package | Read the nearest `package.json`, README, `src/index.ts`, or exports; do not infer a filesystem path from a package name. `@buildingai/core` is at `packages/core`. |
| Ordinary extension source bugfix | Relevant plugin README section, `package.json`, and the source named by the stack trace; do not invoke a reviewer by default. |
| Local extension Web build failure | README build/risk section, `package.json`, Vite config, and build wrapper; by default do not read manifest/registry or invoke UI workflow, reviewer, or release skills. |
| Extension metadata / dependencies / SDK exports / release boundary | Plugin README, `package.json`, `manifest.json`, `extensions/extensions.json` when relevant, plus targeted tests and ECC review |
| Plugin UI design / Design Gallery / frontend-backend UI contract | Target plugin README, route/source contracts, and ECC UI/security review when applicable |
| Plugin roadmap or handoff | Target plugin `README.md`, `ROADMAP.md` when present, the matching plugin skill, current source, and verification evidence |
| Extension release / delivery | `/extension-release-check` |
| Cross-package, root configuration, or unclear verification scope | `/repo-verify`; for a localized package change, use the smallest checks from the target `package.json` |
| Skills and workflow guidance | `skills/README.md`, `skill-developer`, and `scripts/sync-skills.mjs` |
| New external-library APIs | Prefer Context7 from the Codex runtime; when unavailable, use the library's official documentation. Do not restore a project-level `.claude/mcp` launcher. |

Review only the explicit diff for the current task. Keep extension metadata, API security, UI/public-contract, and domain checks scoped to the changed boundary; the primary agent owns deduplication, changes, and final verification.

When the active Claude Code environment provides ECC, use it as the default development harness for every implementation, bugfix, refactor, build/config change, and release-preparation task. If ECC is unavailable, state why and use the equivalent repository-native checks.

### ECC Default Development Lifecycle

Apply this sequence once per development task; skip a stage only when its stated condition makes it inapplicable, and record the skip:

1. **Plan**: start with `/ecc:plan` to restate requirements, ground the approach in the repository, identify risks, and define acceptance/verification. Use `/ecc:plan-prd` when a durable PRD is needed.
2. **Implement**: use `/ecc:tdd-workflow` for behavior changes, bugs, and refactors; write and run the smallest relevant test before production edits, then verify GREEN. Pure documentation or mechanical configuration edits still require a focused syntax/policy check.
3. **Review**: run `/ecc:code-review` after the implementation or configuration change.
4. **Verify**: run `/ecc:verification-loop` and the smallest path-aware package checks. Do not replace narrow project checks with a broad command when the repository provides a smaller sufficient one.
5. **Repair**: use `/ecc:build-fix` only when a real build or typecheck failure occurs; do not invoke it speculatively.
6. **Document and hand off**: use `/ecc:update-docs` when source-of-truth documentation changed, and record the commands, results, and intentional skips in the handoff.

For Auth, Secrets, URLs/downloads, uploads, migrations, queues, billing, and release boundaries, run ECC security review and the smallest relevant tests.

## 3. Core Boundaries

| Area | Rule |
|---|---|
| Plugin business | Put new independent EchoFlow business capabilities under `extensions/echoflow-*`. |
| Main-system capability | Change the main system only for platform-wide capabilities such as notifications, multi-channel delivery, login, billing, Secrets, uploads, queues, or Console foundations. |
| No bypasses | Do not patch the main system to bypass an extension capability. Keep plugin-private defaults, model protocols, business tables, and operational content out of the main system. |
| Upstream sync | The main system is a continuously upstream-synced development base. Before merging upstream, identify EchoFlow-owned shared capabilities and avoid deleting them. |
| Dirty worktree | Do not revert or overwrite someone else's changes. If a file already contains user changes, understand them first and extend them without flattening them. |

Default sensitive paths: `packages/**`, `public/web/**`, `scripts/**`, `docker-compose.yml`, `turbo.json`, `pnpm-workspace.yaml`, the root `package.json`, lockfiles, build artifacts, and release artifacts.

### Upstream Differences and Optimization Decisions

- When comparing with official upstream, review functional, data, security, and runtime contracts first. Treat the EchoFlowAI brand and product patterns explicitly documented here as intentional differences; do not revert them only because names or implementation shapes differ. Node/pnpm runtime behavior is a compatibility contract determined by machine configuration, upstream baseline, and actual builds/critical-path verification, not by second-development status.
- Values originally determined by the environment, admin configuration, browser state, or protocol fields must remain dynamically resolved. Do not turn deployment domains, Secret fields, persistent keys, or public response fields into constants merely because of a brand replacement. Documented fixed product endpoints are exceptions.
- Preserve working improvements. Revert only the part that clearly breaks existing behavior or compatibility. Prefer root-cause fixes, existing helpers, standard libraries, platform features, and minimal diffs; do not add abstractions or dependencies for hypothetical requirements.
- Prefer official or well-maintained open-source container images. If a prebuilt image cannot be maintained, installing required system tools at startup is allowed, but application tool versions must be pinned. Do not replace a verified database or cache image merely for visual consistency.
- Temporary UI state overrides are only for states users do not need to change. If users must expand, collapse, or restore a state, use normal persistent state instead of locking controls with a temporary override.

## 4. Documentation Governance

- Maintain repository-wide duplicate rules only in `AGENTS.md`.
- Keep agent instructions in the primary language already used by the target document; do not create bilingual duplicate rules merely to improve AI readability. Keep commands, paths, code identifiers, API names, and raw error messages unchanged. Reply to the user in Chinese by default; follow the user's explicit language preference for the current request.
- Plugin README files contain plugin-specific facts, evidence, risks, and next steps. Do not duplicate the shared BaseService, RootLayout, locking, UI, rate-limit, notification, upload, billing, or other cross-repository rules there.
- A plugin README's “next steps” must contain only real remaining product, technical, or verification gaps. Move completed work into current capabilities/verification or remove it.
- After design, development, browser QA, build/release, or review-fix work, check whether `AGENTS.md` or the relevant plugin README needs updating. If not, state why in the handoff.
- Delete or mark temporary materials as stale after consolidation. If an original reference, log, or screenshot must remain, record its source, date, purpose, and that it is not a long-lived source of truth.

## 5. Workspace and Command Safety

- Runtime: Node.js `>=22.20.x <23`; the root `.nvmrc` pins `22.20.0`.
- Package manager: the root `package.json` declares `pnpm@10.20.0`.
- Workspace membership is defined by `pnpm-workspace.yaml`: `packages/*`, `extensions/*`, `packages/@buildingai/*`, and `packages/@buildingai/web/*`.
- Shared dependency versions are governed by `catalog`, `catalogs`, and `overrides` in `pnpm-workspace.yaml`; extensions should use `catalog:api`, `catalog:dev`, and `catalog:web` when appropriate.
- pnpm 10+ does not read root `package.json` `pnpm.overrides`, `pnpm.peerDependencyRules`, or `pnpm.onlyBuiltDependencies`; keep these in `pnpm-workspace.yaml`.
- The root `package.json` is not the dependency-override source of truth. Update `pnpm-workspace.yaml` for overrides instead of adding an npm/yarn-style top-level mirror.
- Repository source, workspace links, and `node_modules` should be owned by the current WSL development user. Container commands must not leave root-owned files there. Manage `docker/data` database/cache volumes according to their container user; do not apply a repository-wide `chown`.

Unless explicitly requested or required by the current task, do not automatically run:

- `pnpm install` / `pnpm add` / `pnpm remove`
- `pnpm format` / `pnpm lint:fix`
- Docker lifecycle, PM2 restarts, or database writes
- Full-repository `pnpm build`, broad formatting, or automatic fixers

Do not manually edit generated/runtime directories: `dist`, `build`, `.output`, `.nuxt`, `.temp`, `.turbo`, `packages/client/src-tauri/target`, `packages/client/src-tauri/gen`, runtime storage/uploads, or release zips. `public/web` is a Git-tracked release artifact and must be refreshed only through `scripts/release.mjs`, never manually.

## 6. Extension Structure and Metadata

A typical extension contains `package.json`, `manifest.json`, `README.md`, `src/api/index.ts`, `src/api/modules/app.module.ts`, `src/web/main.tsx`, `src/web/routes.tsx`, `vite.config.*`, `tsup.config.ts`, and migrations/upgrades when needed.

Keep these path terms distinct: the main-system user entry is `/apps/<identifier>/*`; the extension bundle/local-dev base is `/extension/<identifier>/*`. Console route documentation must state whether it is a `consoleRoutes` relative path such as `/console/...` or the full bundle/dev-base path such as `/extension/<identifier>/console/...`.

The following metadata must remain consistent:

| Field | Requirement |
|---|---|
| identifier | The directory name, `manifest.json.identifier`, `package.json.name`, route `identifier/base`, and Vite extension base agree. |
| version | `manifest.json`, `package.json`, and `extensions/extensions.json` agree. |
| engine.buildingai | `manifest.json` and `package.json` agree; the field is singular `engine`. |
| Display metadata | Name, icon, and author information in `manifest.json` and `extensions/extensions.json` agree. |
| installedAt | The local registry uses a real ISO timestamp, not a placeholder. |

In installed environments, display metadata may come from the database `extension` record; changing a manifest, registry, or same-version upgrade does not automatically rewrite existing records. For an unpublished extension, explicitly synchronize local data after changing the `0.0.1` upgrade. For a published extension, add a new semver migration/upgrade and verify the runtime through the API or a read-only database query.

Script constraints:

- `build:publish` must directly chain tool commands; do not nest `pnpm run ...`.
- `check-types` must directly call `vue-tsc --noEmit` or `tsc -p tsconfig.api.json --noEmit` according to the stack.
- CLI tools such as Vite, tsup, vue-tsc, tsc, ESLint, Prettier, Jest, concurrently, cross-env, and rimraf must be declared in the extension's local dependencies/devDependencies.
- Do not invoke a CLI through `node ../../node_modules/...` or another workspace package's `node_modules`.
- `templates/extension-starter/` and `extensions/simple-blog/` are templates/examples and must also follow this section.

Release package facts come from the release allowlist in `packages/cli/src/commands/extension.js`, not from an extension's `package.json.files`.

## 7. Backend and Security Invariants

- Export `AppModule` from the extension API entry `src/api/index.ts`; runtime loading imports `extensions/<identifier>/build/index.js`.
- Use `@ExtensionEntity()` for extension entities, not ordinary `@Entity()` for plugin business tables.
- Use `@ExtensionWebController()` for Web APIs and `@ExtensionConsoleController()` for Console APIs.
- Import extension controller/entity decorators from `@buildingai/core/decorators`; import generic decorators from `@buildingai/decorators`.
- Business services should extend `BaseService<T>` from `@buildingai/base`; do not rewrite common pagination, transaction wrappers, or CRUD.
- Every DTO field must have a class-validator decorator. Nested objects/arrays use `@ValidateNested({ each: true })` with `@Type()`. URLs require explicit `http`/`https`; strings require length or enum bounds.
- Controllers must not catch errors and return 200. Use Nest HTTP exceptions or `HttpErrorFactory` for business errors.
- Keep external AI/HTTP I/O outside long transactions; transactions should cover database reads/writes and state changes only.
- Transactional pessimistic-lock or `SELECT ... FOR UPDATE` paths must set a local lock timeout such as `SET LOCAL lock_timeout = 3000`.
- Use atomic SQL updates for counters instead of read-modify-write; batch database work inside loops to avoid N+1 queries.

## 8. AI, Secrets, Providers, URLs, and Billing

| Capability | Do | Do not |
|---|---|---|
| Standard LLM extension | Register `AiPublicModule` and use `PublicAiModelService` to reuse the main site's model/provider/Secret system. | Build a separate model or secret-management system. |
| Provider config | Use `normalizeProviderConfig`, `resolveProviderEndpointCredential()`, and `resolveProviderSecretValue()`. | Store API keys or secret copies, or reconstruct Secret fields inside the extension. |
| Provider HTTP | Use `requestProviderText`, `requestProviderJson`, `testProviderJsonEndpoint`, `normalizeProviderBaseUrl`, and `safeJsonParse`. | Reimplement fetch, timeout, retry, JSON parsing, or base-URL validation. |
| AI streaming | Propagate upstream errors, user aborts, and stream-conversion failures as terminal failures; show a visible frontend error even when no assistant message was created. | Log only on the server, swallow SSE errors, or leave the UI in a no-response state. |
| Long-document AI | Chunk complete documents at stable boundaries and merge results; set explicit chunk/cost limits and fail closed when exceeded. | Silently process only the first N characters while claiming a full review. |
| AI change application | Apply findings/patches on the backend after validating stable object IDs, the current revision, and the source hash; invalidate stale suggestions after content changes. | Match targets by title or fuzzy text, or submit a reconstructed full document to accept one finding. |
| External URLs/downloads | Before saving/downloading, use `assertPublicHttpUrl()`, `resolvePublicHttpUrl()`, and `downloadPublicHttpUrl()` for protocol, credential, local/private-network, DNS, redirect, timeout, and size checks. | Treat `new URL()` or raw axios/fetch as sufficient. |
| Uploads | Use platform uploads and `fileId`; validate uploader, extension ownership, size, MIME, and extension. | Trust only a URL/path or register a duplicate platform File/Storage repository. |
| Response serialization | Assemble public/admin responses with an explicit allowlist serializer. | Spread `...config`, `...endpoint`, or `...raw` and leak Secrets, base URLs, upstream jobs, or diagnostic fields. |
| Billing | Register `ExtensionBillingModule`, use `ExtensionBillingService`, use the business record ID as `associationNo`, and pass the same `EntityManager` inside the transaction. Charge only after a successful terminal state with a valid result/usage. | Charge for upstream `401/403/429/5xx`, stream errors, user aborts, or missing results; directly alter balances, double-charge, or query the main-system `AccountLog` from the extension. |
| Refunds | Verify accounting facts for failed refunds; write refund failures to restricted metadata with a timestamp. | Claim a complete refund loop without real verification. |

Generated extensions must document the generated object, charging time or price group, and failure-refund policy. The backend Console configuration is authoritative for amounts; do not hard-code prices in the frontend. Web APIs must not return `secretId`, base URLs, API keys, upstream job IDs, admin notes, unsanitized upstream responses, or Console diagnostic fields.

## 9. Queues, Notifications, Data, Upgrades, and Storage

- Long-running flows should use the main-system `QueueModule`, BullMQ/Redis, or an official queue capability. Custom extension queues may import `QueueModule` and use `BullModule.registerQueue()`, `@InjectQueue()`, `@Processor()`, `WorkerHost`, and `Job`.
- Async task recovery must include `onModuleInit` startup recovery and a `@Cron` stale scan. Requeue recovery with a transaction, pessimistic lock, and CAS; stale callbacks/polling/Webhooks must not overwrite terminal states.
- Record enqueue failures as business failures and return observable errors. Paid flows must prevent duplicate charges, refunds, and generated artifacts.
- Prefer `ExtensionRateLimitService` for high-cost Web entry points. Business policy limits for concurrency, daily quotas, or price groups do not replace entry-point anti-abuse rate limiting.
- Use `ExtensionNotificationModule` / `ExtensionNotificationService`; extensions register scenarios and submit events/context instead of reimplementing Web Push, WeChat, SMS, or email delivery.
- Put extension migrations under `extensions/<identifier>/src/api/db/migrations/`; put data repairs/upgrades under `src/api/upgrade/<version>/index.ts`.
- For an unpublished extension, `0.0.1` migrations/upgrades, entities, and defaults may be adjusted directly. After publication, append semver migrations/upgrades.
- Seeds are for first-install initialization only; make them repeatable and use `shouldRun()` or a unique key to avoid duplicates.
- Ship static package files under `storage/static`; keep runtime uploads/generated files under `storage/uploads` or another runtime directory. Store large content as a URL, file ID, or relative path, not as database blobs/base64.

## 10. Frontend and Embedded UI

- Put the extension frontend entry at `src/web/main.tsx`; prefer `defineRouteOption()` from `@buildingai/web-core` for routes.
- Use `consoleRoutes` and `consoleMenus` for complex Console administration.
- Prefer `createPluginHttpClients()` from `@buildingai/services`; do not hand-write `/extension/{id}`, `/api`, or `/consoleapi` prefixes.
- The plugin user UI normally runs inside the main system's `/apps/{identifier}` iframe and extension RootLayout. Do not duplicate the App Header, account area, global statistics, marketing Hero, independent sidebar, or full application shell.
- When using the main system extension RootLayout, do not create another `QueryClient` or `QueryClientProvider`.
- Prefer `@buildingai/ui/components/ui/*`, `cn()`, and Tailwind utilities. Do not maintain large blocks of handwritten CSS for ordinary layout.
- Use plugin CSS only for business typography, editor content, special states, media canvases, and responsive fallbacks that the component library and utilities cannot express.
- Main-system theme variables may be OKLCH or direct color values; do not assume `hsl(var(--primary))` wrapping.
- Prefer `getLocalStorage()`, `getSessionStorage()`, `safeJsonParse()`, and `safeJsonStringify()` from `@buildingai/stores` for browser persistence and JSON tolerance.
- A plugin UI design sandbox must be a dev-only route inside the target plugin. It must not enter production builds, call real generation/charging/uploads/providers/Secrets, or expose raw/provider/Secret/base-URL data or unpublished capabilities.
- Gameplay/management/narrative plugin details such as memory, actions, rewards, accessibility, and copy belong in that plugin's README and tests. This file keeps only the shared rule: serve the business scenario, avoid generic AI chrome, and avoid a generic application shell.

## 11. Build, Release, and Verification

Common command shapes:

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> test
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:publish
```

Use the target `package.json` as the actual command source. For a localized package change, choose the smallest command; for cross-package, root configuration, or unclear scope, use `/repo-verify`; before extension release/delivery, use `/extension-release-check`.

The root `pnpm build` runs the Turbo main build and then `scripts/build-extensions.mjs`, which builds enabled local extensions in `extensions/extensions.json` order. The script makes one serialized Turbo call for cached `build:publish` tasks, avoids rebuilding completed shared dependencies, and avoids concurrent large Vite memory pressure. It then strictly checks each extension's `build/index.js`, `.output/public/index.html`, and actual `AppModule` import. A missing script, failed build, incomplete artifact, or unloadable module must fail predeploy rather than start with an enabled extension silently skipped at runtime.

Default budget for a local Extension Web build fix: read at most 8 directly relevant files in the first pass, perform at most 2 search batches, do not start a subagent by default, and allow at most 2 “edit → target build” rounds. Stop when the target build passes and the diff contains only expected files. Stop and report a blocker when the same error remains unchanged for two rounds or the fix requires install/lockfile changes, Docker, browser state, credentials, or a public API change. Pure Vite, Rollup, tsconfig, dependency-resolution, and build-script failures are not UI design tasks.

Verification principles:

- Run narrow type checks, lint, tests, or builds before considering repository-wide commands.
- Documentation-only changes usually do not need a product build, but their paths, facts, and routing must be checked.
- Real external-model calls, real Secrets, Webhooks, billing, and failure refunds are formal integration tests; if not run, do not describe them as complete real loops.
- Real-environment smoke tests must fail closed: explicitly require tokens and a generation switch when login state, Secrets, balance, Redis/Worker, or external-model calls are needed.
- Report the exact command, error, and next condition for failed or blocked verification.
- If the main system starts but a feature is unusable, first read the complete error stacks in `logs/<year-month>/<day>.log` and `logs/pm2/api-error.log`, then verify the final endpoint, HTTP status, and sanitized error code. Do not attribute the problem from UI symptoms or a single billing log.
- Never print full Secrets during Secret/Provider troubleshooting. Treat `INVALID_API_KEY` and missing credentials as configuration failures first; field presence or irreversible fingerprints may support comparison.
- Distinguish Windows/PowerShell or pnpm shell-shim issues from plugin-code failures.
- Before browser QA, confirm the URL, title, Vite base, port, and business copy; do not treat another plugin's dev server, a main-system error page, or a browser `data:` error page as evidence.

## 12. Git, Upstream, and Environment

- As needed before development, check `git status --short --branch` and `git remote -v`.
- The official upstream is read-only: `upstream=https://github.com/BidingCC/BuildingAI.git`; `remote.upstream.pushurl` must remain `DISABLED_DO_NOT_PUSH_TO_UPSTREAM`.
- Do not submit, push, or open a PR to the official upstream unless the user explicitly requests it for that one operation.
- Confirm the destination remote and branch before pushing; `origin` is not the official upstream.

### ECC-Assisted Upstream Conflict Resolution

- When ECC is available, use `/ecc:plan` first to define the conflict strategy, such as preserving upstream fixes, protecting EchoFlow-owned capabilities, and standardizing the brand. Then use ECC `ecc:code-reviewer` for general conflict-risk analysis; use ECC `ecc:architect` only when an actual architectural trade-off exists.
- During conflict resolution, ECC provides analysis and recommendations only. The developer must manually confirm the resolved content and execute `git add` and `git commit`; after the resolution is written, run `/ecc:code-review` and `/ecc:quality-gate` when ECC is available.
- Conflict review and repair must apply these brand mappings: `cc-haha` → `echoflow`, `Claude-Code-Haha` → `EchoFlow-Code`, and `CC_HAHA_*` → `ECHOFLOW_*`. If an upstream conflict introduces `providerPresets.json` or an equivalent preset file, remove promotional entries such as `jiekouai`, `shengsuanyun`, and `teamorouter`, retaining only presets verified as official. Do not create these files or entries when they do not exist.

```text
# Claude Code conflict-analysis stage
/ecc:plan "合并上游，保留修复，替换品牌名"
# The developer confirms the resolution and manually runs any required git add/git commit.
# After the resolution is written
/ecc:code-review
/ecc:quality-gate
# If the build fails
/ecc:build-fix
```

- Local development should use pnpm: `pnpm dev:main`, or `pnpm dev:web` / `pnpm dev:api` separately; run extension scripts from the extension directory as needed. The Tauri client is an online shell and intentionally loads the configured production site; do not restore a bundled frontend without a product decision.
- Docker may provide Postgres/Redis dependencies and full-environment verification; Claude must not start or stop Docker by default.
- Main-system Docker, PM2, log, permission, and AI-request troubleshooting is documented in `docs/troubleshooting/main-runtime.md`.
- Keep plugin business configuration out of `.env`; use admin configuration or the main-site Secret system.
- After brand static-resource changes, run at least the relevant client build. Refresh release-state `public/web/assets` through the build/release flow; do not edit it manually.

## 13. Delivery Checklist

- [ ] The change is in the correct boundary: plugin business in the plugin; platform-wide capability in the main system.
- [ ] Existing user changes were not overwritten and unrelated files were not formatted.
- [ ] High-risk boundaries for DTOs, Secrets, URLs, uploads, billing, queues, transactions, and public serializers were checked.
- [ ] Plugin metadata, scripts, dependencies, and the release allowlist were checked when relevant.
- [ ] The smallest relevant verification command was run or explicitly explained; failures/skips have clear reasons.
- [ ] Required updates to `AGENTS.md`, `CLAUDE.md`, plugin README, package README, or skills were closed out; if none were needed, state why.
