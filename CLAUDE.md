# Claude Code 项目入口

跨插件、跨主系统的长期规则、任务路由、安全边界和验证要求统一以 [AGENTS.md](AGENTS.md) 为准。本文件只记录 Claude Code 专属入口，不复制通用规范。

## Claude 专属入口

- 插件 UI 设计、页面重构、设计沙箱、Design Gallery 或前后端 UI 契约任务，读取 [.claude/design-workflow.md](.claude/design-workflow.md) 并使用 `echoflow-ui-workflow`。
- Claude Code hooks 和共享设置以 [.claude/hooks](.claude/hooks) 与 [.claude/settings.json](.claude/settings.json) 为准。
- 本仓库不维护项目级 `.claude/mcp` 启动器；外部库新 API 优先由 Codex Context7 核对，Claude Code 独立工作时使用官方文档。密钥、个人数据库连接和本机浏览器配置只放用户级或 `.claude/settings.local.json`，不得提交到仓库。
- 根 [skills](skills) 是项目技能事实源；`.claude/skills` 是由 [scripts/sync-skills.mjs](scripts/sync-skills.mjs) 生成的运行镜像，不直接编辑。

其余 Runtime、Workspace、Docker、API、Client、Extension、Git 和交付规则全部读取 [AGENTS.md](AGENTS.md)。
