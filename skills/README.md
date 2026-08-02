# Skills Management Guide

This repository keeps project skills in the root `skills/` directory and syncs them into AI editor-specific folders with `scripts/sync-skills.mjs`.

The root `skills/` folder is the source of truth. Generated copies such as `.agents/skills/<name>/` and `.claude/skills/<name>/` are editor runtime copies and should not become a second source of truth.

When generic upstream skills conflict with this repository, follow `skills/skill-developer/SKILL.md`, this README, `AGENTS.md`, and `scripts/sync-skills.mjs`. Do not edit generated runtime copies directly for BuildingAI project skills.

## Supported editors

The supported runtime target is defined by `EDITOR_MAP` in `scripts/sync-skills.mjs`:

| Editor name | Target directory |
|---|---|
| `agent` | `.agent/skills/` |
| `agents` | `.agents/skills/` |
| `gemini` | `.gemini/skills/` |
| `kiro` | `.kiro/skills/` |
| `trae` | `.trae/skills/` |
| `windsurf` | `.windsurf/skills/` |
| `cursor` | `.cursor/skills/` |
| `claude` | `.claude/skills/` |
| `vercel` | `.vercel/skills/` |

## Common commands

Use the node script directly when you want to avoid package-manager side effects in a non-interactive environment.

```bash
# Sync one skill to one editor
node scripts/sync-skills.mjs sync <skill-name> <editor>

# Sync one skill to all editors
node scripts/sync-skills.mjs sync <skill-name>

# Sync all skills to one editor
node scripts/sync-skills.mjs sync <editor>

# Sync all skills to all editors
node scripts/sync-skills.mjs sync all

# Check one skill or all skills without writing files
node scripts/sync-skills.mjs check <skill-name> <editor>
node scripts/sync-skills.mjs check all <editor>

# Remove one skill from one editor
node scripts/sync-skills.mjs remove <skill-name> <editor>

# Remove all skills from one editor
node scripts/sync-skills.mjs remove all <editor>
```

The pnpm wrapper is also available:

```bash
pnpm skills sync claude
pnpm skills sync repo-verify claude
pnpm skills check all claude
pnpm skills remove repo-verify claude
```

If the pnpm wrapper unexpectedly triggers install behavior, use the node script and report why.

## Adding or updating a skill

1. Create or edit `skills/<skill-name>/SKILL.md`.
2. Keep the `name` frontmatter aligned with the folder name.
3. Keep long-lived repository facts in `AGENTS.md` or the relevant plugin/package README; skills should provide workflows and routing, not a second architecture source.
4. If the skill should be active in Claude Code, sync only the required skill:

   ```bash
   node scripts/sync-skills.mjs sync <skill-name> claude
   ```

5. If the skill is user-invoked and may recommend heavy validation, release packaging, deployment, or external calls, set `disable-model-invocation: true`.
6. Do not default to dependency installs/upgrades, `pnpm format`, `pnpm lint:fix`, Docker/PM2 lifecycle, database writes, generated artifact writes, or real external model/secret/billing calls. If such a step is required, state why and get explicit authorization.

## Frontmatter policy

Required fields:

- `name`
- `description`

Allowed fields when the skill has a clear reason:

- `disable-model-invocation`: user-invoked workflows that may trigger heavy checks, release packaging, deployment, external calls, or other side effects.
- `allowed-tools`: narrow tool access for read-only or security-sensitive workflows.
- `license`: vendor/upstream license pointer.
- `metadata`: vendor/upstream metadata that does not control BuildingAI behavior.

Do not add arbitrary new frontmatter fields until this policy and `skills/skill-developer/SKILL.md` are updated.

## Active BuildingAI skills

### `repo-verify`

Path-aware verification workflow for BuildingAI/EchoFlow changes. Use after code changes or before handoff to choose the smallest relevant typecheck, lint, test, build, and documentation checks.

### `extension-release-check`

User-invoked extension release and delivery checklist. Use before packaging, publishing, or handing off an EchoFlow extension.

### `echoflow-ui-workflow`

EchoFlow 插件 UI 设计与前后端契约工作流。用于插件页面从零设计、已有页面迭代、Design Gallery、2-3 个设计稿并行探索、浏览器选择、选中方案迁移和落选代码清理。

### `contract-generation-development`

合同插件后续开发和跨对话交接流程。事实以合同插件 README 为准，流程覆盖真实联调、队列恢复、审查规则、编辑冲突、Open File Viewer 和交付收口。

### `echoflow-ai-town-roadmap`

Continuation workflow for the `echoflow-ai-town` game plugin. Use it to resume the first unfinished roadmap phase from actual code and verification evidence, keep conditional engine/AI/social work gated, and update the plugin README and ROADMAP during handoff.

### `echoflow-video-roadmap`

Continuation workflow for the `echoflow-video` single-video kernel and AI short-drama roadmap. Use it to finish the first unverified production gate before media, domain, workflow, Studio or release stages, and keep README/ROADMAP evidence current across conversations.

### `echoflow-astrology-roadmap`

Staged continuation workflow for `echoflow-astrology-fortune`. It resumes the first unfinished README phase, keeps deterministic chart and versioned fact foundations ahead of Report V2, UI, and Product Agent work, and routes domain/security/UI/release reviews.

## Other available skills

These skills may be useful when synced, but they are not the primary authority for repository facts:

- `project-architecture`: navigation and source-of-truth routing for this monorepo.
- `skill-developer`: creating and maintaining BuildingAI project skills.
- `ai-sdk`: AI SDK usage guidance; dependency changes still require explicit reason and approval.
- `frontend-design`: frontend design guidance; BuildingAI embedded-plugin UI constraints in `AGENTS.md` and plugin README take precedence.
- `postgresql-table-design`: PostgreSQL schema design guidance.
- `skill-creator` / `skill-writer`: generic skill authoring references.
- `web-artifacts-builder`: low-frequency artifact/project generation guidance; use cautiously because it may involve installs or separate artifact projects.

## Documentation routing

- Cross-repo rules: `AGENTS.md`.
- Claude Code entrypoint: `CLAUDE.md`.
- Plugin facts: `extensions/<identifier>/README.md`.
- Verification: `skills/repo-verify/SKILL.md`.
- Extension release: `skills/extension-release-check/SKILL.md`.
- Plugin UI workflow: `skills/echoflow-ui-workflow/SKILL.md` and `.claude/design-workflow.md`.
- Contract plugin handoff: `skills/contract-generation-development/SKILL.md` and `extensions/echoflow-contract-generation/README.md`.
- AI Town staged continuation: `skills/echoflow-ai-town-roadmap/SKILL.md` and `extensions/echoflow-ai-town/ROADMAP.md`.
- Video and AI short-drama staged continuation: `skills/echoflow-video-roadmap/SKILL.md` and `extensions/echoflow-video/ROADMAP.md`.
- Astrology staged continuation: `skills/echoflow-astrology-roadmap/SKILL.md` and `extensions/echoflow-astrology-fortune/README.md`.
- Skill sync implementation: `scripts/sync-skills.mjs`.

## Reviewer and hook governance

- Claude reviewer definitions live in `.claude/agents/`; Codex counterparts live in `.codex/agents/`. Keep names, descriptions, and instructions aligned while preserving each runtime's file format.
- Shared hook scripts under `.claude/hooks/` and `.codex/hooks/` must remain identical. Hook commands use workspace-relative paths, never a developer-specific checkout path.
- Run `node scripts/check-agent-governance.mjs` after reviewer, hook, or related routing changes.
