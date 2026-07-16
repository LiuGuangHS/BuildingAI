# Advanced Skill Maintenance Notes

This repository currently uses Claude Code's normal skill loading plus a project sync script. It does not maintain a custom skill activation rules JSON.

## Current model

- Source skills: `skills/<name>/`.
- Generated editor copies: `.claude/skills/<name>/`, `.cursor/skills/<name>/`, etc.
- Sync implementation: `scripts/sync-skills.mjs`.
- Claude shared hooks: `.claude/hooks/pretool-guard.mjs` and `.claude/hooks/changed-files-verify.mjs`.
- Claude shared settings: `.claude/settings.json`.

## Future ideas

If the project later needs richer skill governance, prefer small explicit additions:

- Generated editor support table from `scripts/sync-skills.mjs`.
- A test that validates active synced skills match root source skills.
- Documentation lint that checks paths in `SKILL.md` files.
- Optional hook checks for high-risk writes, implemented in `.claude/hooks/*.mjs` and registered in `.claude/settings.json`.

Do not introduce a hidden second authority for repository rules. Cross-repo policy still belongs in `AGENTS.md`; skills should route to it.

## Related files

- `SKILL.md` - main BuildingAI skill authoring guide.
- `HOOK_MECHANISMS.md` - current project hook notes.
- `TROUBLESHOOTING.md` - sync and discovery troubleshooting.
