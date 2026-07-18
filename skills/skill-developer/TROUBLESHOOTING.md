# Skill Troubleshooting

Use this guide when a BuildingAI skill is missing, stale, or not visible in an editor.

## Skill not visible in an editor

1. Confirm the source skill exists:

   ```bash
   ls skills/<skill-name>/SKILL.md
   ```

2. Sync it to the target runtime, for example Codex or Claude Code:

   ```bash
   node scripts/sync-skills.mjs sync <skill-name> agents
   node scripts/sync-skills.mjs sync <skill-name> claude
   ```

3. Confirm the generated copy exists:

   ```bash
   ls .agents/skills/<skill-name>/SKILL.md
   ls .claude/skills/<skill-name>/SKILL.md
   ```

4. Run `node scripts/sync-skills.mjs check <skill-name> <editor>`. If it passes but the current session still does not show the skill, reload that runtime's project configuration.

## Generated copy differs from source

Treat root `skills/` as the source of truth and resync:

```bash
node scripts/sync-skills.mjs sync <skill-name> claude
```

For active BuildingAI skills, generated runtime copies should match the root `skills/<name>/SKILL.md` byte-for-byte.

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

## Reviewer or hook drift

Run:

```bash
node scripts/check-agent-governance.mjs
```

It checks Claude/Codex reviewer parity, shared hook parity, JSON validity, and machine-specific Codex hook paths. Reviewers and hooks do not auto-activate skills; route workflows explicitly in `AGENTS.md`, `CLAUDE.md`, the relevant skill, or the reviewer prompt.
