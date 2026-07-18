---
name: echoflow-astrology-roadmap
description: Resume, plan, implement, review, or hand off staged development for the echoflow-astrology-fortune plugin. Use when continuing astrology work, selecting the next roadmap phase, changing deterministic chart/report/Agent/UI behavior, or updating long-term status and verification evidence.
---

# EchoFlow Astrology Roadmap Workflow

Use this skill to continue `extensions/echoflow-astrology-fortune` without relying on chat history. Product facts, current status, and the complete roadmap live in the plugin README; this skill defines only the repeatable resume and handoff workflow.

## Required reading

Read these before planning or editing:

1. `AGENTS.md` and `CLAUDE.md`.
2. `extensions/echoflow-astrology-fortune/README.md`.
3. The plugin `package.json`, `manifest.json`, and current `git status --short --branch`.
4. Actual source, tests, config, or runtime evidence required by the first unfinished README phase.
5. `skills/repo-verify/SKILL.md` before choosing verification.

Use `skills/project-architecture/SKILL.md` when ownership is unclear, `skills/ai-sdk/SKILL.md` for AI/Agent work, `skills/echoflow-ui-workflow/SKILL.md` for page-level UI work, and `skills/extension-release-check/SKILL.md` before release.

For deterministic chart, Snapshot, transit, compatibility, fact/evidence, or Report V2 changes, also read `references/domain-review.md` completely before editing or reviewing.

## Authority order

1. Machine config and actual source behavior.
2. `AGENTS.md` cross-repository rules.
3. Plugin README current facts, evidence, risks, and phase order.
4. This workflow and its domain review reference.

If planning text conflicts with source or current evidence, update the README rather than changing code merely to match stale text.

## Resume protocol

1. Preserve unrelated and pre-existing worktree changes.
2. Reproduce the current evidence for the first `next`, unfinished, or blocked phase when the check is cheap and non-mutating.
3. Select one coherent phase batch with a testable stopping condition; do not start later Agent or UI work while deterministic prerequisites are incomplete.
4. State scope, files, dependency/environment needs, public/security/billing impact, reviewers, and minimum verification before editing.
5. Implement through review and verification unless the user requested analysis only.
6. Update the plugin README whenever capability status, evidence, risk, dependency decision, or the next resume point changes.
7. Hand off the exact first unfinished task without relying on conversation context.

## Phase discipline

- Keep deterministic astronomy and versioned facts authoritative; AI may explain them but must not create or write them back as facts.
- Keep Snapshot input hash, engine version, rule-set version, result schema, and historical immutability explicit.
- Degrade missing birth time, coordinates, or timezone honestly; never fabricate ascendant, houses, precision, or confidence.
- Prefer synchronous deterministic calculation until measured latency justifies a dedicated queue.
- Add Product Agent behavior only after the README workflow gate is satisfied. Agent tools start read-only; paid or mutating actions require explicit user confirmation through existing APIs.
- Prefer existing platform helpers and direct dependencies with a concrete gap. Candidate libraries in the README are not approved or installed facts.

## Reviewer routing

Use reviewers only when their boundary changed:

| Changed area | Reviewer/workflow |
|---|---|
| Chart math, timezone, Snapshot, facts, Report V2 evidence | `astrology-domain-reviewer` or `references/domain-review.md` |
| API, DTO, DB, public serializer, queue, billing, Agent tools | `security-boundary-reviewer` |
| Manifest, dependency, script, SDK export, release artifact | `extension-boundary-reviewer` |
| UI, Design Gallery, public capability, responsive states | `extension-ui-contract-reviewer` |

Run independent read-only reviews in parallel after a coherent implementation diff. The main agent owns edits, conflict resolution, and verification.

## Approval and environment gates

Do not run by default:

- `pnpm install`, `pnpm add`, `pnpm remove`, or lockfile rewrites.
- Ownership changes, generated-directory cleanup, Docker/PM2 lifecycle, or database writes.
- Real provider/model/Secret/billing/refund calls or paid report generation.
- Release packaging, deployment, or browser profile changes.

When a gate is required, explain the exact command, scope, external effect, and rollback or stop condition before proceeding.

## Verification and handoff

Choose the smallest checks from the plugin `package.json` and `repo-verify`. Keep these evidence classes separate:

- Static/type/unit checks.
- API/Web/publish builds, including isolated `/tmp` workarounds.
- Main-system runtime and browser QA.
- Real Redis/Worker/model/billing/refund smoke.
- Release artifact and installed-runtime validation.

At handoff, report the phase completed, exact checks and results, blockers and external conditions, README/skill changes, reviewers used, and the first unfinished task. Never mark a phase ready from planning text, source-string tests alone, historical commands, or skipped external smoke.
