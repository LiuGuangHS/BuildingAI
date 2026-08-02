# Skills 管理指南

本仓库把项目 skills 存放在根目录 `skills/`，并通过 `scripts/sync-skills.mjs` 同步到各 AI 编辑器的配置目录。

根目录 `skills/` 是事实源；`.agents/skills/<name>/`、`.claude/skills/<name>/` 这类目录是编辑器运行时副本，不应成为第二套事实源。

当通用上游 skill 与本仓库规则冲突时，以 `skills/skill-developer/SKILL.md`、本 README、`AGENTS.md` 和 `scripts/sync-skills.mjs` 为准。BuildingAI 项目 skill 不要直接编辑生成的运行时副本。

## 支持的编辑器

受支持的运行时目标以 `scripts/sync-skills.mjs` 中的 `EDITOR_MAP` 为准：

| 编辑器名称 | 同步目录 |
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

## 常用命令

在非交互环境下，为避免 pnpm wrapper 意外触发安装行为，可以直接使用 node 脚本：

```bash
# 同步单个 skill 到单个编辑器
node scripts/sync-skills.mjs sync <skill-name> <editor>

# 同步单个 skill 到所有编辑器
node scripts/sync-skills.mjs sync <skill-name>

# 同步所有 skills 到单个编辑器
node scripts/sync-skills.mjs sync <editor>

# 同步所有 skills 到所有编辑器
node scripts/sync-skills.mjs sync all

# 只读检查单个或全部 skill 是否同步
node scripts/sync-skills.mjs check <skill-name> <editor>
node scripts/sync-skills.mjs check all <editor>

# 从单个编辑器移除单个 skill
node scripts/sync-skills.mjs remove <skill-name> <editor>

# 从单个编辑器移除所有 skills
node scripts/sync-skills.mjs remove all <editor>
```

也可以使用 pnpm wrapper：

```bash
pnpm skills sync claude
pnpm skills sync repo-verify claude
pnpm skills check all claude
pnpm skills remove repo-verify claude
```

如果 pnpm wrapper 在非交互环境中触发安装或其他额外行为，改用 node 脚本并在交付说明中说明原因。

## 新增或更新 skill

1. 创建或编辑 `skills/<skill-name>/SKILL.md`。
2. 保持 frontmatter 的 `name` 与目录名一致。
3. 长期仓库事实放在 `AGENTS.md` 或对应插件/包 README；skill 负责工作流和路由，不维护第二套架构事实。
4. 如果该 skill 需要在 Claude Code 中生效，只同步目标 skill：

   ```bash
   node scripts/sync-skills.mjs sync <skill-name> claude
   ```

5. 如果 skill 是用户显式调用，并且可能建议重验证、发布打包、部署或外部调用，使用 `disable-model-invocation: true`。
6. 不默认执行依赖安装/升级、`pnpm format`、`pnpm lint:fix`、Docker/PM2 生命周期、数据库写入、生成 artifact 写入或真实外部模型/Secret/计费调用。若确实需要，先说明原因并取得明确授权。

## Frontmatter 策略

必填字段：

- `name`
- `description`

有明确用途时允许：

- `disable-model-invocation`：用户显式调用，且可能触发重检查、发布打包、部署、外部调用或其他副作用的流程。
- `allowed-tools`：只读或安全敏感流程的工具收窄。
- `license`：vendor/upstream license 指针。
- `metadata`：不控制 BuildingAI 行为的 vendor/upstream 元数据。

新增其他 frontmatter 字段前，先更新本策略和 `skills/skill-developer/SKILL.md`。

## 当前主要 BuildingAI skills

### `repo-verify`

按路径选择最小验证矩阵。代码改动后或交付前使用，用于选择 typecheck、lint、test、build 和文档检查。

### `extension-release-check`

用户显式调用的插件发布/交付检查清单。插件打包、发布或交付前使用。

### `echoflow-ui-workflow`

EchoFlow 插件 UI 设计与前后端契约工作流。用于插件页面设计、Design Gallery、方案选择、生产迁移和落选代码清理。

### `contract-generation-development`

合同插件后续开发和跨对话交接流程。事实以合同插件 README 为准，流程覆盖真实联调、队列恢复、审查规则、编辑冲突、Open File Viewer 和交付收口。

### `echoflow-ai-town-roadmap`

`echoflow-ai-town` 游戏插件的分阶段接力工作流。用于根据实际代码和验证证据找到路线图中首个未完成阶段，约束条件性引擎、AI、社交能力，并在交付时同步插件 README 和 ROADMAP。

### `echoflow-video-roadmap`

`echoflow-video` 单视频内核和 AI 短剧路线图的分阶段接力工作流。先完成首个未验证的生产门禁，再进入媒体、领域、工作流、Studio 或发布阶段，并在跨对话交付时同步 README 和 ROADMAP。

### `echoflow-astrology-roadmap`

`echoflow-astrology-fortune` 星盘插件的分阶段接力工作流。用于从 README 中首个未完成阶段恢复开发，确保确定性计算和版本化事实先于 Report V2、UI 与产品 Agent，并路由领域、安全、UI 和发布审查。

## 其他可用 skills

这些 skill 可按需同步，但它们不是仓库事实的最高权威：

- `project-architecture`：monorepo 导航和事实源路由。
- `skill-developer`：创建和维护 BuildingAI 项目 skills。
- `ai-sdk`：AI SDK 使用指导；依赖变更仍需说明原因并获得明确授权。
- `frontend-design`：前端设计指导；BuildingAI 嵌入式插件 UI 约束以 `AGENTS.md` 和插件 README 为准。
- `postgresql-table-design`：PostgreSQL 表结构设计指导。
- `skill-creator` / `skill-writer`：通用 skill 编写参考；若与 root `skills/` + sync 流程冲突，以 `skill-developer` 为准。
- `web-artifacts-builder`：低频独立 artifact/project 生成指导；可能涉及安装、独立项目或 bundle 产物，只有用户明确要求 artifact/原型时才使用。

## 文档路由

- 跨仓库规则：`AGENTS.md`。
- Claude Code 入口：`CLAUDE.md`。
- 插件事实：`extensions/<identifier>/README.md`。
- 验证流程：`skills/repo-verify/SKILL.md`。
- 插件发布：`skills/extension-release-check/SKILL.md`。
- 插件 UI 工作流：`skills/echoflow-ui-workflow/SKILL.md` 与 `.claude/design-workflow.md`。
- 合同插件开发交接：`skills/contract-generation-development/SKILL.md` 和 `extensions/echoflow-contract-generation/README.md`。
- 乐园小镇阶段接力：`skills/echoflow-ai-town-roadmap/SKILL.md` 与 `extensions/echoflow-ai-town/ROADMAP.md`。
- 视频与 AI 短剧阶段接力：`skills/echoflow-video-roadmap/SKILL.md` 与 `extensions/echoflow-video/ROADMAP.md`。
- 星盘插件阶段接力：`skills/echoflow-astrology-roadmap/SKILL.md` 与 `extensions/echoflow-astrology-fortune/README.md`。
- 同步实现：`scripts/sync-skills.mjs`。

## Reviewer 与 Hook 治理

- Claude reviewer 位于 `.claude/agents/`，Codex 对应定义位于 `.codex/agents/`；名称、描述和指令保持一致，同时保留各 Runtime 的文件格式。
- `.claude/hooks/` 与 `.codex/hooks/` 的共享脚本必须一致；Hook 命令使用工作区相对路径，不写开发者本机 checkout 绝对路径。
- reviewer、Hook 或相关路由变化后运行 `node scripts/check-agent-governance.mjs`。
