# Skill Discovery and Routing Notes

Claude Code skill discovery is driven primarily by skill metadata, invocation, and task context. This repository does not maintain a separate trigger-rule configuration.

## Practical trigger design

Use the `description` frontmatter to make activation intent clear:

```yaml
---
name: repo-verify
description: BuildingAI/EchoFlow path-aware verification workflow. Use after code changes or before handoff to choose the smallest relevant lint, typecheck, test, build, and documentation checks for this monorepo.
---
```

Good descriptions mention:

- The task type.
- Relevant paths or domains.
- Whether the skill is for user-invoked workflows only.
- Important constraints such as avoiding mutating commands.

## User invocation

If a skill should only run when the user requests it, set:

```yaml
disable-model-invocation: true
```

Examples in this repository:

- `extension-release-check` is user-invoked because it may recommend heavier build/release checks.

## Path routing inside skills

Because layered docs are not read automatically, each skill should name the files it depends on. Example routing:

| Task | Route to |
|---|---|
| Cross-repo rule | `AGENTS.md` |
| Plugin change | plugin README, `package.json`, `manifest.json` |
| Verification | `skills/repo-verify/SKILL.md` |
| Extension release | `skills/extension-release-check/SKILL.md` |
| Skill sync | `skills/README.md`, `scripts/sync-skills.mjs` |

## Avoid

- Broad generic descriptions that could trigger for unrelated tasks.
- Hardcoded package trees that drift from `pnpm-workspace.yaml`.
- Duplicating all of `AGENTS.md` inside a skill.
- Relying on hidden auto-activation files that do not exist in this repository.
