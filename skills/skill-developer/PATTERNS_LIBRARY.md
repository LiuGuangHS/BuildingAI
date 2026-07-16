# Skill Writing Patterns

Reusable patterns for BuildingAI project skills.

## Frontmatter patterns

### Claude-invocable workflow

```yaml
---
name: repo-verify
description: BuildingAI/EchoFlow path-aware verification workflow. Use after code changes or before handoff to choose the smallest relevant checks.
---
```

### User-invoked workflow

```yaml
---
name: extension-release-check
description: User-invoked EchoFlow extension release and delivery checklist.
disable-model-invocation: true
---
```

## Routing block pattern

```md
## Source routing

- Cross-repo rules: `AGENTS.md`.
- Plugin facts: `extensions/<identifier>/README.md`, `package.json`, `manifest.json`.
- Verification: `skills/repo-verify/SKILL.md`.
- Release checks: `skills/extension-release-check/SKILL.md`.
```

## Safety block pattern

```md
## Commands to avoid unless explicitly requested

- `pnpm format`
- `pnpm lint:fix`
- `pnpm install`, `pnpm add`, `pnpm remove`
- Docker/PM2 lifecycle commands
- Database writes or migrations against a live DB
```

## Handoff pattern

```md
Report:

- Changed area and why the selected commands were sufficient.
- Commands run and exact result.
- Commands skipped and why.
- Whether docs or generated skill copies needed updates.
- Remaining blockers.
```

## Avoid

- Duplicating all of `AGENTS.md` inside a skill.
- Listing exhaustive package trees that can drift from `pnpm-workspace.yaml`.
- Mentioning non-existent paths as if they are active project config.
- Making user-invoked release/deploy workflows model-invocable by default.
