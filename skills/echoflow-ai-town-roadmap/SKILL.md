---
name: echoflow-ai-town-roadmap
description: Resume, plan, implement, review, or hand off staged development for the echoflow-ai-town game plugin. Use when continuing 乐园小镇 work, checking its roadmap, deciding the next phase, or updating its long-term plan and verification evidence.
---

# EchoFlow AI Town Roadmap Workflow

Use this skill to continue `extensions/echoflow-ai-town` without relying on stale chat context. The skill defines the resume workflow; product facts live in the plugin README and source, while unfinished phases live in `ROADMAP.md`.

## Required reading

Read these before planning or editing:

1. `AGENTS.md`.
2. `extensions/echoflow-ai-town/package.json` and `manifest.json`.
3. `extensions/echoflow-ai-town/README.md`.
4. `extensions/echoflow-ai-town/ROADMAP.md`.
5. `git status --short --branch` and the current diff for files in scope.
6. Actual source, tests, shared packages, settings, build helpers, or runtime logs required by the first unfinished roadmap phase.

Use `skills/project-architecture/SKILL.md` when package ownership is unclear, `skills/repo-verify/SKILL.md` for verification scope, `skills/echoflow-ui-workflow/SKILL.md` for page-level UI design, and `skills/extension-release-check/SKILL.md` before release.

## Authority order

1. Machine config and actual source behavior.
2. `AGENTS.md` cross-repo rules.
3. Plugin `README.md` current facts and evidence.
4. Plugin `ROADMAP.md` unfinished plan and phase order.
5. This workflow.

If the roadmap conflicts with current code or configuration, fix the roadmap or README as part of the task. Never patch code merely to match stale planning text.

## Resume protocol

1. Reproduce the current evidence for the first unfinished or blocked phase when it is cheap and non-mutating.
2. Classify the result as `pending`, `in-progress`, `blocked`, `current`, `complete`, or `conditional` using the definitions in `ROADMAP.md`.
3. Select one coherent phase batch that can reach an honest stopping condition.
4. State the scope, files, external requirements, security/billing impact, and minimum verification before editing.
5. Implement through review and verification; do not stop after writing a proposal unless the user asks for planning only.
6. Update README current facts/evidence and ROADMAP phase status immediately after the evidence changes.
7. Leave an explicit next resume point for the following task.

## Phase discipline

- Start with R0 until type, build, settings, browser prerequisites, and release prerequisites are trustworthy.
- Do not start Pixi, Phaser, Three.js, workers, local models, queues, content CRUD, multiplayer, or UGC unless the corresponding conditional gate in `ROADMAP.md` is satisfied.
- Keep deterministic resources, rewards, relationships, progression, saves, billing, and refunds server-authoritative.
- Keep AI limited to advice, narrative, resident performance, content drafts, and other validated non-authoritative roles.
- Preserve `TownSceneSnapshot`, presentation cue, public serializer, storage, billing, and DOM accessibility contracts when changing rendering or UI.
- Prefer existing helpers, native browser capabilities, and current dependencies. New dependencies require a concrete workflow or measured performance gap.
- Large files are not a standalone refactor target. Extract only a tested ownership boundary that reduces complexity in the active phase.

## Approval and environment gates

Do not run these by default:

- `pnpm install`, `pnpm add`, `pnpm remove`, or lockfile rewrites.
- Ownership changes outside the smallest affected generated directory.
- Docker/PM2 lifecycle commands or database writes.
- Real provider, Secret, model, billing, refund, webhook, or paid generation calls.
- Browser profile changes, committed CDP endpoints, or committed login state.
- Release packaging or deployment.

When a gate is required, explain the exact need and scope. Browser and credential configuration stays user-local.

## Verification and handoff

Choose the smallest checks from the target package and `repo-verify`. Keep these evidence classes separate:

- Static/type/unit checks.
- API/Web/publish builds.
- Main-system runtime and browser QA.
- Real provider/model/billing/refund smoke.
- Release artifact and installed-runtime validation.

At handoff, report:

- Roadmap phase and tasks completed.
- Exact checks run and their results.
- Blockers and required external conditions.
- README/ROADMAP/skill changes.
- The first unfinished task for the next conversation.

Never mark a phase complete because planning text was added, a historical command once passed, or an external smoke was skipped.
