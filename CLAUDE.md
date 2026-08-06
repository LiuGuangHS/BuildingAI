# Claude Code Project Entry Point

[AGENTS.md](AGENTS.md) is the authoritative source for cross-extension and cross-system project rules. This file only contains high-frequency constraints and runtime routing that Claude Code needs on every session; it does not duplicate the full project rules.

## Claude-Specific Entry Points

- Reply to the user in Chinese by default. Keep commands, paths, code identifiers, API names, and raw error messages unchanged. Follow the user's explicit language preference for the current request.
- When ECC is available in the active environment, use it as the default development harness for the full lifecycle: `/ecc:plan` → `/ecc:tdd-workflow` when behavior changes → `/ecc:code-review` → `/ecc:verification-loop`, with `/ecc:build-fix` only after an actual build/type failure and `/ecc:update-docs` when source-of-truth docs need synchronization. Follow [AGENTS.md](AGENTS.md) for project reviewers, complementary quality gates, minimal checks, and documented exceptions. ECC may assist with upstream conflict analysis, but the developer must manually confirm the final merge and any `git add`/`git commit`.
- For plugin UI design, page redesign, design sandboxes, Design Gallery, or frontend/backend UI contracts, read [.claude/design-workflow.md](.claude/design-workflow.md) and use `echoflow-ui-workflow`.
- Claude Code hooks and shared settings are defined by [.claude/hooks](.claude/hooks) and [.claude/settings.json](.claude/settings.json).
- This repository does not maintain a project-level `.claude/mcp` launcher. For new external-library APIs, prefer Context7 from the Codex runtime; when unavailable, use the library's official documentation. Keep secrets, personal database connections, and local browser configuration in user-level settings or `.claude/settings.local.json`; never commit them.
- The root [skills](skills) directory is the project skill source of truth. `.claude/skills` is the generated runtime mirror produced by [scripts/sync-skills.mjs](scripts/sync-skills.mjs); do not edit it directly.
