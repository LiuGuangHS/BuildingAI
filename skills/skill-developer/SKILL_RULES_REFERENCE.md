# Skill Configuration Reference

BuildingAI project skills are configured by `SKILL.md` frontmatter and synchronized by `scripts/sync-skills.mjs`. There is no repository-specific skill trigger rules JSON in the current setup.

## Required frontmatter

```yaml
---
name: repo-verify
description: BuildingAI/EchoFlow path-aware verification workflow.
---
```

Rules:

- `name` should match the folder name under `skills/<name>/`.
- `description` should explain when Claude or the user should use the skill.
- Use lowercase kebab-case names.
- Keep the main `SKILL.md` focused; use reference files only for stable supporting material.

## User-invoked skills

Use `disable-model-invocation: true` for skills that should only run when the user explicitly invokes them, especially when they may recommend heavy validation, release packaging, deployment, external calls, or other side effects.

```yaml
---
name: extension-release-check
description: User-invoked EchoFlow extension release and delivery checklist.
disable-model-invocation: true
---
```

## Repository routing

Skills should route to durable facts instead of copying them:

- Cross-repo rules: `AGENTS.md`.
- Claude entrypoint: `CLAUDE.md`.
- Plugin facts: `extensions/<identifier>/README.md`.
- Package facts: package `package.json`, README, and exports/source files.
- Sync implementation: `scripts/sync-skills.mjs`.

## Sync targets

Editor targets are defined in `scripts/sync-skills.mjs` (`EDITOR_MAP`). Keep `skills/README.md` and `skills/README.zh-CN.md` aligned with that script.

Typical sync command:

```bash
node scripts/sync-skills.mjs sync <skill-name> claude
```

## Validation checklist

- [ ] Folder name and frontmatter `name` match.
- [ ] Description is specific to when the skill should be used.
- [ ] The skill does not contradict `AGENTS.md`.
- [ ] Paths and commands exist in this repository.
- [ ] User-invoked side-effect/heavy workflows set `disable-model-invocation: true`.
- [ ] Active Claude skills are synced from root `skills/` to `.claude/skills/`.
