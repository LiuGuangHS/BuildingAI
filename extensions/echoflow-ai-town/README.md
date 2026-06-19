# 乐园小镇

`echoflow-ai-town` 是 EchoFlow 的小镇经营叙事插件。用户端直接进入可玩小镇，围绕存档、行动、居民关系、事件、日结、今日计划和居民对话形成日常循环；Console 负责模型配置、存档诊断、日志和运营排查。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 经营叙事游戏，不做营销落地页或“进入工作台”中转页。 |
| AI 价值 | 作为镇务参谋、叙事导演和居民表演层；资源、奖励、扣费和成长仍由确定性规则控制。 |
| 用户体验 | 第一屏展示小镇场景、资源、目标、建筑/居民热点和行动入口。 |
| 商业方向 | 优先售卖故事深度、记忆容量、角色章节、季节活动和外观表达；不卖数值碾压。 |
| 管理职责 | Console 只做 AI 配置、存档管理、日志统计、测试生成和异常诊断。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 存档 | ready | 支持创建、读取、软删除；删除时同步软删除角色和事件。 |
| 行动循环 | ready | 经营、拜访、布置、探索、升级和休息都会经过服务端规则结算。 |
| 行动预算 | ready | 每日行动预算、同日重复动作拦截和 `rest` 重置已在服务端和前端联动。 |
| 资源审计 | ready | 行动结果和日结展示金币、体力、声望、关系和等级 delta，并记录行动、选择、建筑、居民目标、预算、规则来源和模型/fallback 状态。 |
| 居民对话 | ready | 支持主站 LLM 调用、本地 fallback、日志记录和关系推进。 |
| 居民记忆 | ready | 保存摘要、心情、偏好、约定、关键时刻和有限最近消息；prompt 只取白名单记忆片段。 |
| 记忆闭环 | ready | 待回应约定会影响推荐目标、行动预览、地图热点、镇务参谋和 Console 诊断。 |
| 连续开张 | ready | `worldState.retention` 记录有效日程、连续天数和下次回访钩子。 |
| Catalog | ready | 建筑、区域、初始居民、基础行动、事件选项、日常任务、周目标、主线章节、成就和节日候选已迁入 catalog。 |
| 正式计费 | pending | 当前只记录 AI 调用日志，尚未接入 `ExtensionBillingModule`。 |
| Phaser 主场景 | reserved | 当前仍是 React 场景化界面；Phaser 可后续评估，但不进入默认发布路径。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-ai-town/` | `src/web/pages/index.tsx` | 小镇主场景、存档、行动、聊天、事件、日结和目标。 |
| Console | `/extension/echoflow-ai-town/console/` | `src/web/pages/console/saves/list.tsx` | 存档列表、详情、预算、记忆和异常诊断。 |
| Console | `/extension/echoflow-ai-town/console/ai-config` | `src/web/pages/console/ai-config.tsx` | LLM 模型、温度、token、fallback、每日限制和测试生成。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册，包含 Web `routes` 和 Console `consoleRoutes` / `consoleMenus`。

## API 与后端模块

| 模块 | 文件 | 说明 |
|---|---|---|
| Module | `src/api/modules/town/town.module.ts` | 导入 `AiPublicModule`，注册小镇业务服务和规则服务。 |
| Web Controller | `controllers/web/town.web.controller.ts` | 用户端存档、行动、聊天、事件和状态接口。 |
| Console Controller | `controllers/console/town.controller.ts` | 管理端配置、存档、日志、统计和测试生成接口。 |
| TownService | `services/town.service.ts` | 存档事务、行动结算、聊天写回、软删除和恢复边界。 |
| TownAiService | `services/town-ai.service.ts` | 主站 LLM 调用、结构化建议、居民回复、fallback 和日志。 |
| Rule Services | `town-world-rules.service.ts`、`town-relationship-rules.service.ts`、`town-progress-rules.service.ts` | 天气、日结、关系、任务、成就、解锁和奖励计算。 |
| Catalog | `catalog/*.ts` | 默认建筑、区域、居民、基础行动、事件选项、任务、周目标、主线章节、成就和节日候选。 |

后端写入阶段使用存档锁保护资源、关系、任务和事件一致性；模型调用不放在长事务内。

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| LLM | 通过 `AiPublicModule` / `PublicAiModelService` 获取启用 LLM 和 Provider adapter。 |
| Provider Config | 使用 `@buildingai/extension-sdk` 的 `normalizeProviderConfig()`，兼容常见 `apiKey` / `baseURL` 字段别名。 |
| Secret | 模型密钥来自主站 Provider Secret；插件不保存 API Key，不写 `.env`。 |
| 上传 | 当前小镇不处理用户上传文件。 |
| 计费 | 尚未接入正式扣费；商业化前需使用行动、聊天或事件 ID 作为 `associationNo`。 |
| 队列 | 当前 AI 调用为业务请求内编排；如引入长流程记忆压缩或章节生成，应优先接主系统队列。 |
| 通知 | 当前无异步终态或离线触达事件，暂不接入通知；后续长任务或运营触达应复用 `ExtensionNotificationService`。 |
| UI | 用户端和 Console 优先复用主系统 Button、Card、Input、Select、Tabs、Badge、Label 等组件。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 存档、角色、事件、AI 配置和 AI 调用日志均使用 `@ExtensionEntity()`。 |
| Migration | 首版 migration：`src/api/db/migrations/1781539200003-0.0.1-init-ai-town.ts`。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等修复 AI 配置单例键，并写入主系统 extension 安装记录。 |
| 初始内容 | 初始世界、角色和事件由 `createSave()` 在事务内生成；当前无独立 seed 文件。 |
| 软删除 | 删除存档会软删除存档、角色和事件；列表和统计默认只看未删除数据。 |
| 静态资源 | 运行界面资源位于 `src/web/assets` 和 `storage/static`，发布包只依赖白名单内静态文件。 |

## 玩法与 AI 规则

| 规则 | 要求 |
|---|---|
| 数值边界 | AI 不直接改金币、体力、声望、关系、扣费或退款。 |
| 结构化输出 | 今日计划和事件必须经过服务端校验、裁剪和 intent 白名单映射。 |
| fallback | 模型未配置、禁用或失败时使用世界观化本地结果；用户端不展示上游错误或 fallback 字样。 |
| 日程 | 行动预算、重复动作拦截和休息重置以服务端为最终边界。 |
| 记忆 | LLM prompt 只携带摘要、心情、偏好、约定、关键时刻和最近少量消息。 |
| 审计 | 资源变化应展示玩家可读解释，Console 可看到预算、记忆和异常诊断。 |

## 开发与验证

```bash
pnpm --filter echoflow-ai-town check-types
pnpm --filter echoflow-ai-town build:api
pnpm --filter echoflow-ai-town build:web
pnpm --filter echoflow-ai-town test
pnpm --filter echoflow-ai-town build:publish
```

当前已知验证状态：

| 命令 | 状态 | 说明 |
|---|---|---|
| `check-types` | pass | 已在 Node 22.23.0 / pnpm 10.20.0 环境通过。 |
| `test` | pass | 当前测试覆盖 catalog 守门、行动预算、居民记忆、推荐闭环、可玩首屏、连续开张和下次回访钩子。 |
| `build:api` | pass | API 产物已包含 catalog、migration 和 `0.0.1` upgrade。 |
| `build:web` | pass | Vite 8 / Rolldown 已恢复构建；仍有 `lucide` 等 chunk size warning，后续按实际加载成本拆包。 |
| `build:publish` | pass | 已完成 `build:clean -> build:web -> build:api` 发布构建链路。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| AI 上下文与写回分阶段 | 并发行动时 AI 文案可能基于稍早状态，资源结算仍以锁内最新状态为准。 | 如需强一致叙事，引入 action revision 或处理中状态。 |
| 内容包仍未 seed 化 | 运行内容已从规则服务迁入 catalog，但还没有后台内容包、赛季或 seed 初始化能力。 | 后续把可运营内容扩展为 catalog + seed/config，并保持 service 只做事务、校验和编排。 |
| 未接正式计费 | 无法对今日计划、聊天或深度事件做余额预检、扣费和失败退款。 | 接入 `ExtensionBillingModule` 前先确定免费额度、订阅权益和内容包边界。 |
| Web 包体偏大 | `lucide` 等共享 chunk 超过 Vite 默认 500KB 提醒。 | 结合真实首屏指标拆分 Console、图标和低频面板。 |
| Phaser 仅预留 | 目前还不是 Canvas/Phaser 游戏内核。 | 先保持 React 可发布路径，再做只读场景评估。 |

## 下一步

| 优先级 | 任务 |
|---|---|
| P1 | 完成 5 分钟闭环 smoke：创建存档 -> 早晨目标 -> 2 到 3 次行动 -> 事件 -> 日结 -> 第二天变化。 |
| P1 | 为 catalog 内容补充内容包版本号、赛季分组和安装/升级 seed 策略。 |
| P1 | 基于真实首屏性能拆分 Console、低频面板和图标 chunk。 |
| P2 | 设计正式计费模型，再接 `ExtensionBillingModule`。 |
| P2 | 评估 Phaser 只读 TownScene，与 React HUD/抽屉通过 bridge 通信。 |
| P2 | 补世界规则、关系推进、任务进度、AI fallback、记忆压缩和计费幂等 focused tests。 |
