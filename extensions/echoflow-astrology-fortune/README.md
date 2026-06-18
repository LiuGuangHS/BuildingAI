# AI 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的 AI 星盘与运势报告插件，基于出生信息、星座生肖、长期档案和用户问题生成每日运势、性格洞察、情感配对、事业财富与生活决策建议。

## 功能范围

- 用户端直接展示星盘运势工作台。
- 支持创建个人档案、更新档案、删除档案和查看档案列表。
- 支持生成每日运势、性格报告、关系配对和决策建议。
- 支持报告列表分页、报告详情、收藏、复制、重生成和删除。
- Console 管理端支持默认 LLM 模型配置、不同报告类型定价、报告列表、聚合统计、档案列表、超时任务处理和报告删除。

## 配置

- 管理员需要在 Console 配置默认 LLM 模型。
- Console 只展示启用的 LLM 模型和启用的 Provider；保存配置时后端会再次校验模型可用性。
- 模型列表会返回 `providerName` 和 Provider 对象，前端展示必须与接口字段保持一致。
- 模型 Provider 的 API Key、Base URL 等敏感配置走平台密钥配置，不写入源码、`manifest.json`、前端包或 `.env`。
- 用户侧不暴露模型选择，仅显示生成与报告结果。

## 前端交互与主题

- Console 页面使用平台 `@buildingai/ui` 组件组织模型配置、报告记录和用户档案，统计卡片读取后端聚合接口，不使用当前页数据推断全量状态。
- 用户端保留星盘主题视觉，但输入、文本域、选择器、弹窗、复制和 toast 优先使用平台组件与 hooks，减少自造控件导致的主题和移动端显示漂移。
- 报告类型、状态文案和价格分组统一维护在 `src/web/constants/report-types.ts`，避免 Web 与 Console 分别维护导致漂移。
- 历史报告按页加载，切换类型或收藏筛选时重置到第一页。

## 计费

- 插件按报告类型读取后台配置价格：每日、普通报告、配对、决策。
- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 报告入库后预扣额度，使用报告 ID 作为 `associationNo` 避免重复扣费。
- AI 失败时报告标记为 `failed` 并自动退款，退款失败会写入 `providerMetadata.refundError` 便于排查；即使报告已软删除，补偿和退款错误记录仍会读取历史记录。
- 报告处于 `pending` 或 `processing` 时，用户端和 Console 均禁止删除，避免后台生成已扣费但结果写回被软删除吞掉。

## 数据与存储

- 插件实体使用 `@ExtensionEntity()`，表位于插件独立 schema。
- 业务实体包括星盘档案、运势报告和插件设置。
- 不存储真实密钥；模型和 Provider 信息只保存平台模型 ID 与 Provider ID。
- Windows + pnpm 本地构建沿用插件 Vite alias 解析 `react-router-dom`、`react-router`、`radix-ui`、`zustand` 和 `@buildingai/utils`，避免发布构建时 Rolldown 无法解析工作区依赖。

## 种子数据

当前插件不需要初始化种子数据。首次访问设置时会幂等创建默认设置记录。

## Migration 与 Upgrade

- 当前纳入版本为未上线首版 `0.0.1`。
- 首版 migration `src/api/db/migrations/1781539200002-0.0.1-init-astrology-fortune.ts` 覆盖档案、报告、设置表和 `key=default` 单例约束；安装联调时需验证 migration 在目标数据库执行成功。
- 首版 Upgrade：`src/api/upgrade/0.0.1/index.ts` 会幂等写入主系统 `extension` 安装记录，确保本地插件启用后用户端和 Console 的扩展详情接口能识别该插件。
- 为兼容已经跑过旧版 `0.0.1` migration 的本地库，首版 Upgrade 会补齐 `astrology_fortune_settings.key` 列和唯一索引；全新安装仍以首版 migration 为准。
- 未上线前的结构修复已合并回首版 migration 和首版 Upgrade，不保留额外本地迭代版本。
- 后续字段变更时再提升 `package.json.version` 与 `manifest.json.version`，并补充 migration 或 `src/api/upgrade/<version>/index.ts`。

## 质量门禁

- `pnpm --filter echoflow-astrology-fortune check-types`
- `pnpm --filter echoflow-astrology-fortune build:api`
- `pnpm --filter echoflow-astrology-fortune build:web`
- 发布前补跑 `pnpm --filter echoflow-astrology-fortune build:publish`，并做用户端与 Console 页面 smoke。

## 后续待办

- 为报告生成、计费幂等、超时任务回收补 focused unit tests。
- 增加报告内容安全提示，避免绝对化预测、医疗、法律或投资保证。
- 抽取 Web/Console 共用报告详情组件，进一步减少展示逻辑重复。
- 继续评估用户档案表单是否需要引入 `react-hook-form` + `zod`，当前先保持受控表单，避免为小表单引入过重改造。

## 后端业务逻辑审查（2026-06-15）

### 模块拆解

| 模块 | 当前逻辑 | 黑盒/隐含规则 |
|------|----------|---------------|
| Profile | 用户维护出生档案；生成时可选择已有档案，也可随请求创建新档案。 | 内联档案会直接落库，缺少去重或“临时档案”概念。 |
| Report | 创建 `PENDING` 报告后通过主系统 `QueueModule` 的 BullMQ/Redis 基础设施生成内容；成功后写结构化结果、文本、摘要和模型快照。 | 插件只注册 `echoflow-astrology-report` 业务队列和 Worker；队列不可用时才回退到本地后台流程，服务启动仍会通过短期恢复锁认领未超时且保留请求载荷的任务。 |
| Setting | Console 维护 `key=default` 单例配置、默认模型和不同报告类型价格；首次访问自动创建默认设置；Console 另有超时任务回收接口。 | 配置读取是纯读；超时报告回收通过显式运维接口触发。 |
| Console Stats | Console 报告统计接口按报告筛选条件聚合 total / success / failed / pending / processing / busy / favorite。 | 列表分页和统计共用同一套筛选 helper；统计不受当前页影响。 |
| Billing | 生成前余额预检，报告入库后按报告 ID 幂等预扣；失败时退款。 | 扣费和退款 helper 都有锁、业务状态和 `AccountLog` 检查；退款失败记录支持软删除记录，便于补偿历史异常任务。 |
| Model | 只允许启用的 LLM 模型和启用的 Provider；用户端不暴露模型选择。 | 模型返回同时包含 `providerName` 和 Provider 对象，前端类型必须保持一致。 |
| Content | Prompt 生成每日、性格、配对和决策建议。 | 后端还没有强制内容安全层，免责声明和绝对化预测约束主要依赖 Prompt / 前端文案。 |

### 问题与修复规划

| 优先级 | 模块 | 问题 | 影响 | 修复规划 |
|--------|------|------|------|----------|
| P1 | Report Worker | 报告生成已接入主系统 `QueueModule`，但本地 fallback 仍保留。 | 队列 worker 配置、Redis 连通性和多实例恢复还需要真实 smoke。 | 后续补队列 smoke；若主系统 `QueueService` 未来支持动态队列，再收敛到统一 enqueue API。 |
| P2 | Setting | 超时报告回收需要显式触发。 | 普通配置读取不会顺手完成维护，运维动作需要单独调用。 | 保持显式运维接口，并考虑增加定时任务或后台守护调用。 |
| P2 | Profile | 生成时内联档案会直接创建正式档案。 | 用户可能因一次性提问产生重复档案。 | 增加“临时输入不保存”选项，或按姓名/生日/用户做去重提示。 |
| P2 | Content Safety | Prompt 已要求避免绝对化预测、医疗、法律和投资保证，但后端没有统一结果后处理。 | 运势、决策建议仍可能因模型输出漂移出现过度确定承诺。 | 在结果后处理里增加规则校验或二次审查；报告详情展示固定免责声明。 |
| P3 | Delete / Profile Relation | 删除档案前会检查是否还有处理中报告引用。 | 处理中报告已读取档案后仍可能成功写回，但用户看到的档案关系不清晰。 | 历史报告继续保存档案快照并在详情展示。 |

### 已确认较好的边界

- 设置表通过 `key=default` 唯一约束保持单例，首次访问并发创建会捕获唯一键冲突并回读既有配置。
- 生成前会先做余额预检，再决定是否创建内联档案，避免余额不足时留下多余正式档案。
- 服务启动会通过 `recoveryLockedAt` 短期恢复锁认领未超时的中断报告；超时报告会失败并按账务事实尝试退款。
- 用户端和 Console 端均通过 `assertReportNotBusy()` 禁止删除 `pending` / `processing` 报告。
- 档案删除前会检查是否仍有关联的处理中报告，避免删除后关系状态失真。
- 扣费使用报告 ID 作为 `associationNo`，并在事务内检查既有扣费日志。
- 退款逻辑会检查 `AccountLog` 的扣费/退款事实，退款失败记录使用 `withDeleted: true` 查询，已软删除但仍需补偿的历史异常报告也可处理。
- Console 模型保存会重新校验模型和 Provider 处于启用状态。
