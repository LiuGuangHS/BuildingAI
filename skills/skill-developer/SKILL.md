---
name: skill-developer
description: Create and maintain BuildingAI project skills. Use when adding or updating root skills, syncing them to supported editor folders, checking SKILL.md frontmatter, or aligning skills with this repository's hooks and documentation routing.
---

# BuildingAI Skill Developer Guide

Use this skill when creating, updating, syncing, or reviewing skills in this repository. It is the main BuildingAI entrypoint for skill maintenance; generic `skill-writer` and `skill-creator` guidance is only a reference when it does not conflict with this file.

## Repository-specific model

This repository uses normal editor skill loading plus a project sync script. It does **not** use a custom skill activation rules JSON.

Current sources of truth:

- Source skills live in `skills/<name>/`.
- Editor-specific copies are generated under folders such as `.agents/skills/<name>/` and `.claude/skills/<name>/` by `scripts/sync-skills.mjs`; do not edit generated copies as the source.
- Shared Claude Code hooks live in `.claude/hooks/pretool-guard.mjs` and `.claude/hooks/changed-files-verify.mjs`.
- Shared Claude Code settings live in `.claude/settings.json`.
- Project-wide rules live in `AGENTS.md`; editor-specific entrypoints such as `CLAUDE.md` stay short and route back to it.

Do not add or document hidden skill activation config or extra hook layers unless the repository actually introduces them.

## When to update a skill

Update a skill when:

- The user asks for a repeatable workflow, checklist, or slash-command style process.
- A project rule is procedural enough to be executed step by step, such as verification or extension release checks.
- Existing skill guidance points at stale paths, package names, commands, or hooks.
- A skill should explicitly route the active agent to `AGENTS.md`, a plugin README, or a package README.

Do not put product architecture facts only in a skill. Skills are workflow aids, not the highest authority for repository facts.

## Creating or editing a project skill

1. Create or edit `skills/<skill-name>/SKILL.md`.
2. Keep frontmatter accurate:

   ```yaml
   ---
   name: skill-name
   description: Clear trigger/use description for this repository.
   # disable-model-invocation: true  # only for user-invoked workflows with side effects/heavy checks
   ---
   ```

3. Keep `SKILL.md` focused and scannable. Put long examples under reference files only when they are stable and intentionally maintained.

   Frontmatter policy:
   - Required: `name`, `description`.
   - Allowed with a clear reason: `disable-model-invocation`, `allowed-tools`, `license`, `metadata`.
   - Do not add arbitrary fields until `skills/README.md` and this skill are updated.
4. Make source-of-truth routing explicit:
   - Cross-repo rules: read `AGENTS.md`.
   - Plugin facts: read `extensions/<identifier>/README.md`.
   - Verification: use `skills/repo-verify/SKILL.md`.
   - Extension release: use `skills/extension-release-check/SKILL.md`.
5. Avoid hardcoding package trees or script lists that can be derived from `pnpm-workspace.yaml` or `package.json` unless the skill also says how to refresh them.

## Syncing skills

Use the repository script; do not manually maintain generated copies as a second source of truth.

```bash
node scripts/sync-skills.mjs sync <skill-name> <editor>
node scripts/sync-skills.mjs sync <editor>
```

The pnpm wrapper exists, but if it unexpectedly triggers install behavior in a non-interactive environment, use the node script directly and report why.

Supported editor names are defined in `scripts/sync-skills.mjs` (`EDITOR_MAP`). Keep `skills/README.md` and `skills/README.zh-CN.md` aligned with that script.

## Project skill conventions

- User-invoked skills that may recommend heavy validation, release packaging, deployment, or external calls should set `disable-model-invocation: true`.
- Skills with side effects must say what they may run and what they must not run by default.
- For this repository, do not recommend `pnpm install`, dependency changes, `pnpm format`, `pnpm lint:fix`, Docker/PM2 lifecycle, or database writes unless the user explicitly asks or the task requires it.
- If a skill changes root `skills/`, sync the required runtime targets defined by `EDITOR_MAP`; do not assume `.claude/skills/` is the only consumer.

## Review checklist

Before finishing a skill change, verify:

- Frontmatter is valid YAML and the `name` matches the folder name.
- The skill does not contradict `AGENTS.md` or `CLAUDE.md`.
- Paths mentioned by the skill exist or are clearly described as examples.
- Commands match this repository's package manager and scripts.
- The skill explains whether it is model-invocable or user-invoked only.
- Generated copies are synced to the editor runtimes that need the skill.

## Supporting references

- `SKILL_RULES_REFERENCE.md`: frontmatter and sync reference for this repository.
- `HOOK_MECHANISMS.md`: current project hook notes.
- `TRIGGER_TYPES.md`: skill discovery and routing notes.
- `PATTERNS_LIBRARY.md`: reusable skill writing snippets.
- `TROUBLESHOOTING.md`: sync and discovery troubleshooting.

## Related active skills

- `repo-verify`: path-aware verification and handoff checklist.
- `extension-release-check`: user-invoked extension release/delivery checklist.
- `project-architecture`: repository navigation and source-of-truth routing.
