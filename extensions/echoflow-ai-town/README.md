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

当前插件不需要独立 seed 文件。初始世界、角色与事件由 `createSave()` 在事务内生成。

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

## 后端业务逻辑审查（2026-06-15）

### 模块拆解

| 模块 | 当前逻辑 | 黑盒/隐含规则 |
|------|----------|---------------|
| Save | 创建存档时写初始世界、角色和欢迎事件；删除存档会软删除存档、角色和事件。 | 初始世界、NPC、任务和事件都由服务代码生成，不来自 seed 或可配置数据。 |
| Action | `operate`、`visit`、`decorate`、`explore`、`rest`、`advice`、`upgrade` 会计算资源、体力、声望、进度、解锁、关系和事件。 | 行动进入事务后锁定同一存档，再做资源校验、状态变更和事件写入。 |
| Chat | NPC 聊天会生成 AI 回复或本地 fallback，提升关系并推进轻量进度。 | 聊天和行动共享同一存档锁，避免并发覆盖写。 |
| World Rules | 天气、每日结算、区域解锁、活动、建筑升级和世界默认值都在规则服务内计算。 | 多数规则是代码常量，管理端暂不能配置。 |
| Relationship Rules | 关系等级、行动加成、升级折扣、NPC 剧情事件由规则服务决定。 | 关系目标会偏向关系最低角色，属于隐含分配策略。 |
| Progress Rules | 每日任务、周目标、主线任务和成就推进由规则服务决定。 | `rest` 会推进日期并刷新每日任务；周目标刷新逻辑藏在行动流程内。 |
| Town AI | Console 配置默认 LLM、温度、token、fallback、每日限制；记录 AI 调用日志。 | AI 未配置或禁用时也会写 fallback 日志并纳入每日限制。 |

### 问题与修复规划

| 优先级 | 模块 | 问题 | 影响 | 修复规划 |
|--------|------|------|------|----------|
| 已修复 | Action / Chat | 行动和聊天读取存档后在事务外计算，事务内没有 `pessimistic_write` 锁定同一存档。 | 并发点击可能让金币、体力、进度、关系和事件出现覆盖写或重复结算。 | 行动和聊天已在写入阶段锁定 `TownSave` 后更新。 |
| 已修复 | Town AI Config | 配置表没有单例键或唯一约束；首次并发保存可能创建多条配置。 | `getConfig()` 只取最早一条，后续配置可能被忽略；旧安装升级后可能缺少 `key` 列导致配置页 500。 | 已将 `key=default` 字段和唯一约束合并进首版 `0.0.1` migration，并在 `0.0.1` upgrade 中幂等补列、回填旧配置和补唯一索引。 |
| 已修复 | Town AI Logs | AI 禁用、未配置或 fallback 成功时不写调用日志。 | 管理端统计看不到本地 fallback 的真实使用量，每日限制也不覆盖 fallback。 | fallback/disabled 路径已写日志，并在日志前做每日限制校验。 |
| 已修复 | Action / Chat | AI 调用曾在存档锁事务内执行。 | 上游模型慢时会占用数据库连接和行锁。 | 已改为事务外准备 AI 文本、事务内重新锁定最新存档并写入结果；最终资源结算仍以锁内最新状态为准。 |
| P1 | Action / Chat | 两阶段 AI 生成可能基于稍早的存档上下文。 | 并发行动时，AI 文案可能不是完全最新，但资源、任务和关系结算仍保持一致。 | 后续如需强一致叙事，可引入 action revision 或短事务写入处理中状态，再异步校验 revision 后写 AI 文案。 |
| P2 | Rule Data | 初始世界、角色、活动、任务和奖励都硬编码在服务里。 | 运营无法配置，规则变更需要发布代码。 | 保留代码默认值，同时规划 seed/配置表或 JSON 静态配置；关键规则补单测快照。 |
| P2 | Billing | AI 调用目前只记日志，不接入正式插件计费。 | 如果模型成本需要由用户承担，当前无法扣费或退款。 | 若进入商业化，接入 `ExtensionBillingModule`，用行动/聊天事件 ID 作为 `associationNo`。 |
| P2 | Observability | AI fallback 会写调用日志，但普通行动、资源结算和规则命中没有结构化审计日志。 | 线上排查“金币/体力为什么变化”时只能追事件文本和存档状态。 | 为行动结算增加规则快照或审计字段，至少记录原值、delta、触发规则和 AI fallback 状态。 |
| P3 | Abuse Control | 除 AI 每日限制外，普通行动没有频率限制。 | 用户可快速刷资源或制造大量事件。 | 增加每存档行动冷却、每日行动上限或服务端节流。 |

### 已确认较好的边界

- Web / Console 入口职责清晰：用户端只做存档和玩法，Console 做 AI 配置、日志、统计和测试生成。
- 删除存档会软删除角色和事件，避免孤儿业务数据。
- 模型列表只返回启用 LLM 且 Provider 启用的模型。
