# BuildingAI Agent Hook Notes

This repository uses two shared hook scripts for Claude Code and Codex. They are project safety and verification helpers, not a custom skill activation engine.

## Current hooks

Registered in `.claude/settings.json` and `.codex/hooks.json`:

| Event | Matcher | Script | Purpose |
|---|---|---|---|
| `PreToolUse` | `Write|Edit|MultiEdit|NotebookEdit|Bash` | `hooks/pretool-guard.mjs` | Blocks or asks before high-risk file edits and commands. |
| `PostToolUse` | `Write|Edit|MultiEdit|NotebookEdit` | `hooks/changed-files-verify.mjs` | Records files touched by the active agent in the session. |
| `Stop` | n/a | `hooks/changed-files-verify.mjs` | Emits path-aware verification hints for touched files. |

The `.claude/hooks/` and `.codex/hooks/` copies must remain identical. Runtime registration commands use workspace-relative paths.

## What these hooks do not do

- They do not auto-activate arbitrary skills.
- They do not read a skill trigger rules file.
- They do not auto-run formatters, installs, Docker, PM2, or database commands.
- They do not replace `/repo-verify` or `/extension-release-check`.

## PreToolUse guard behavior

`pretool-guard.mjs` protects high-risk operations such as:

- `.env` and local secret files.
- Generated/runtime directories such as `dist`, `build`, `.output`, `.turbo`, runtime storage, and release artifacts.
- Cautious config files such as root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `docker-compose.yml`, plugin manifests, and `extensions/extensions.json`.
- High-risk commands such as dependency installs/changes, format fixers, `git reset`, Docker lifecycle, and destructive removals.

## Changed-files verification behavior

`changed-files-verify.mjs` records files changed by Claude Write/Edit-style tools and suggests minimal verification at Stop. It is advisory and path-aware; it does not run the checks automatically.

If files are changed by shell commands, still inspect `git status` / diff because PostToolUse path tracking may not see every shell-created file.

## Testing hook changes

When editing hook scripts or settings, prefer small static checks:

```bash
node -e "JSON.parse(require('node:fs').readFileSync('.claude/settings.json','utf8'))"
node -e "JSON.parse(require('node:fs').readFileSync('.codex/hooks.json','utf8'))"
node .claude/hooks/pretool-guard.mjs < simulated-hook-input.json
node .claude/hooks/changed-files-verify.mjs < simulated-hook-input.json
node scripts/check-agent-governance.mjs
```

Do not add mutating auto-fix hooks unless the user explicitly asks and the behavior is documented.
