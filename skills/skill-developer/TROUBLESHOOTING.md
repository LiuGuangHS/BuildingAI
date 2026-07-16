# Skill Troubleshooting

Use this guide when a BuildingAI skill is missing, stale, or not visible in an editor.

## Skill not visible in Claude Code

1. Confirm the source skill exists:

   ```bash
   ls skills/<skill-name>/SKILL.md
   ```

2. Sync it to Claude Code:

   ```bash
   node scripts/sync-skills.mjs sync <skill-name> claude
   ```

3. Confirm the generated copy exists:

   ```bash
   ls .claude/skills/<skill-name>/SKILL.md
   ```

4. If the current Claude session does not show the new skill, restart/reload Claude Code or use the UI that refreshes project config.

## Generated copy differs from source

Treat root `skills/` as the source of truth and resync:

```bash
node scripts/sync-skills.mjs sync <skill-name> claude
```

For active BuildingAI skills, the generated `.claude/skills/<name>/SKILL.md` should match the root `skills/<name>/SKILL.md`.

## Unknown editor name

Supported editors come from `EDITOR_MAP` in `scripts/sync-skills.mjs`. If a README lists an editor that the script rejects, update the README or the script so they match.

## pnpm wrapper triggers install behavior

The root pnpm wrapper is convenient:

```bash
pnpm skills sync repo-verify claude
```

If it unexpectedly triggers install/removal behavior in a non-interactive environment, use the node script directly:

```bash
node scripts/sync-skills.mjs sync repo-verify claude
```

Report that choice in the handoff.

## Skill content seems stale

Check for:

- Paths that no longer exist.
- Node/pnpm versions that disagree with root `package.json` and `.nvmrc`.
- Package names not present in `pnpm-workspace.yaml`.
- Commands not present in the target `package.json`.
- Guidance that contradicts `AGENTS.md` or `CLAUDE.md`.

Use `/repo-verify` after skill/doc updates to choose the minimal verification.

## Hook confusion

Current BuildingAI Claude hooks are project safety/verification hooks:

- `.claude/hooks/pretool-guard.mjs`
- `.claude/hooks/changed-files-verify.mjs`

They do not auto-activate all skills. If a workflow needs a skill, route to it explicitly in `CLAUDE.md`, `AGENTS.md`, the relevant skill, or the subagent prompt.
