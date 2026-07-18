---
name: echoflow-video-roadmap
description: Resume, plan, implement, review, verify, or hand off staged development for the echoflow-video plugin and its AI short-drama roadmap. Use when continuing video generation, real production validation, media infrastructure, short-drama domain/workflow, Studio, or release work.
---

# EchoFlow Video Roadmap Workflow

Use this skill to continue `extensions/echoflow-video` without relying on prior chat context. Product facts and current evidence live in the plugin README and actual code; unfinished stages, dependencies and gates live in `ROADMAP.md`.

## Required reading

Before planning or editing, read in this order:

1. `AGENTS.md`.
2. `extensions/echoflow-video/package.json` and `manifest.json`.
3. `extensions/echoflow-video/README.md`.
4. `extensions/echoflow-video/ROADMAP.md`.
5. `git status --short --branch` and the current diff for files in scope.
6. Actual source, tests, shared SDK code, runtime logs or environment facts required by the first unfinished roadmap phase.

Use `project-architecture` when ownership is unclear, `repo-verify` for verification scope, `ai-sdk` when changing AI SDK calls, `echoflow-ui-workflow` for page-level UI work, and `extension-release-check` before packaging or release.

## Authority order

1. Machine configuration and actual source/runtime behavior.
2. `AGENTS.md` cross-repository rules.
3. Plugin README current facts and verification evidence.
4. Plugin ROADMAP unfinished plan and phase order.
5. This workflow.

If planning text conflicts with source or current evidence, update the planning text. Never change working code merely to match a stale roadmap statement.

## Current resume gate

The default resume point is **A7 single-video real production closure**. Do not implement short-drama entities, batch shots, dubbing, composition or complete Studio UI until stage A is honestly complete.

First check whether these external conditions exist without printing their values:

- `VIDEO_TEST_DATABASE_URL`
- `BASE_URL`
- `ADMIN_AUTH_TOKEN`
- `WEB_USER_AUTH_TOKEN`
- `VIDEO_E2E_GENERATION_ENABLED=true`
- Redis, storage, active main-site video models, test Secrets, test balance and test media

If a condition is missing, continue only with safe in-scope work that remains genuinely verifiable. Report the missing condition as pending or blocked; do not replace real evidence with mocks, historical commands or planning text.

## Resume protocol

1. Reproduce cheap, non-mutating evidence for the first unfinished or blocked stage.
2. Classify each affected item using ROADMAP states: pending, in-progress, blocked, code-ready, current, complete or conditional.
3. Select one coherent stage batch that can reach an honest stopping condition.
4. Before edits, state scope, ownership, external effects, security/billing impact and minimum verification.
5. Implement through review and verification; do not stop at a proposal unless the user requests planning only.
6. Update README current facts/evidence and ROADMAP status as soon as evidence changes.
7. Leave the exact first unfinished task and required environment for the next conversation.

## Phase discipline

- Finish A7 before stage B-D implementation.
- Stage B may move low-risk metadata, preview, cover extraction and preflight checks to the client; server state, generation, billing and official assets remain authoritative.
- Media conversion and composition belong in bounded media Workers, not API request handlers or browser-only trusted flows.
- Stage C must establish stable IDs, revision/source hash, ownership, serializers and Upgrade contracts before workflow orchestration.
- Shot generation must reuse the single-video kernel; do not duplicate Provider, Secret, queue, billing, notification, upload or storage layers.
- Workflow scheduling must be idempotent, dependency-aware, budget-bounded and explicit about partial success.
- AI may create structured drafts, generate media and perform checks; it must not decide permissions, task truth, revisions, billing, refunds or official asset ownership.
- Keep unverified abilities invisible and fail closed on unknown models, Providers or media types.
- Do not add an Agent framework, media engine, renderer, dependency or abstraction without a concrete gap in the active phase.

## Security and state invariants

- Public serializers remain explicit allowlists and never expose Secret, Provider internals, main-model IDs, task IDs, raw payloads or internal storage paths.
- Client requests submit stable IDs and bounded parameters; server reads trusted upload and model facts.
- Provider IO stays outside long database transactions.
- Terminal generation and workflow states cannot be overwritten by stale Workers, callbacks or polling.
- Paid Provider work is not automatically replayed after processing starts.
- Deduction/refund uses platform billing facts and stable business association IDs; no direct balance mutation.
- Large media stays in platform/plugin storage, not Base64 database columns or unbounded API memory.

## Approval and environment gates

Do not run these by default:

- `pnpm install`, dependency changes or lockfile rewrites.
- `pnpm format`, `pnpm lint:fix` or unrelated cleanup.
- Docker/PM2 lifecycle, database writes or ownership changes.
- Real Provider/model/Secret/billing/refund/notification calls.
- Release packaging, extension installation, deployment or rollback.

When one is required, explain the exact scope, cost and side effects first. Use test accounts, test balance, test Secrets and disposable data. Never print credentials or unredacted Provider payloads.

## Verification classes

Keep these separate in reports and documentation:

1. Static, type and unit checks.
2. API/Web/publish builds.
3. Disposable PostgreSQL Upgrade tests.
4. Redis/Worker/multi-instance integration tests.
5. Main-system browser QA at desktop and 390px.
6. Real model, storage, billing, refund and notification smoke.
7. Release artifact, install, upgrade and rollback validation.

Use target package scripts and `repo-verify`. For real E2E, require the explicit generation switch and credentials documented in README/ROADMAP.

## Documentation and handoff

At every stopping point report and persist:

- Roadmap stage and tasks completed.
- Exact checks run, Runtime and results.
- External smoke performed or skipped, with reasons.
- Security, billing, storage and migration findings.
- README/ROADMAP changes.
- The next stage gate and first unfinished action.

Never mark a stage complete because code compiles, a historical build passed, a mock succeeded, or a roadmap was written. A future conversation must be able to resume by reading `AGENTS.md`, this skill, the plugin README/ROADMAP and current source without needing old chat history.
