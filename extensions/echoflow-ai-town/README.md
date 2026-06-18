# AI 乐园小镇

`echoflow-ai-town` 是 EchoFlow 的 AI 小镇经营插件，核心玩法包括日常经营、居民关系、探索事件、建筑升级、AI 建议和 NPC 对话。

## 功能范围

- 用户端直接展示小镇经营主界面。
- 支持新建存档、读取存档、删除存档、行动推进和居民聊天。
- 支持随机事件、节日活动、主线任务、关系推进和资源结算。
- Console 管理端支持存档管理、AI 配置、模型查看、日志查看、统计和测试生成。

## 配置

- 管理员在 Console 配置可用 LLM 模型。
- Console 只展示启用的 LLM 模型和启用的 Provider；保存默认模型时后端会再次校验模型可用性。
- 模型列表返回 `providerName` 供后台展示，用户侧不暴露模型选择。
- 模型 Provider 的 API Key、Base URL 等敏感配置走平台密钥配置，不写入源码、`manifest.json`、前端包或 `.env`。
- 用户侧仅提示 AI 生成可能消耗额度，不暴露模型选择。

## 计费

- 插件内 AI 建议、聊天和结构化事件可能消耗额度。
- 当前实现通过插件自身的 AI 服务记录调用日志，并由平台模型配置提供推理能力。
- 若后续引入正式计费，需要再接入 `ExtensionBillingModule`，不要直接修改用户余额。

## 数据与存储

- 插件实体使用 `@ExtensionEntity()`，表位于插件独立 schema。
- 业务实体包括存档、角色、事件、AI 配置和 AI 调用日志。
- 删除存档会软删除存档、角色和事件，后台统计和列表默认只统计未删除记录。
- 运行时图片资源放在插件内 `src/web/assets` 与 `storage/static`，发布只依赖静态 icon。

## 种子数据

当前插件不需要独立 seed 文件。初始世界、角色与事件由 `createSave()` 并发生成。

## Migration 与 Upgrade

- 当前纳入版本为 `0.0.1`，已提交首版插件 migration：`src/api/db/migrations/1781539200003-0.0.1-init-ai-town.ts`。
- 首版 migration 覆盖存档、角色、事件、AI 配置和 AI 调用日志；安装联调时需验证 migration 在目标数据库执行成功。
- 首版 Upgrade：`src/api/upgrade/0.0.1/index.ts` 会幂等修复 `town_ai_configs.key` 单例配置列，并写入主系统 `extension` 安装记录，确保旧本地安装和新安装都能识别插件配置。
- 后续字段变更时提升 `package.json.version` 与 `manifest.json.version`，并补充 migration 或 `src/api/upgrade/<version>/index.ts`。

## 质量门禁

- `pnpm --filter echoflow-ai-town check-types`
- `pnpm --filter echoflow-ai-town build:api`
- `pnpm --filter echoflow-ai-town build:web`
- `pnpm --filter echoflow-ai-town test`

## 后续待办

- 为世界规则、关系推进、AI 建议和聊天补 focused unit tests。
- 视需要再决定是否接入正式插件计费模块。
