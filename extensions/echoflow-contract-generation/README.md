# AI 合同生成与审查

`echoflow-contract-generation` 是 EchoFlow 的合同起草、审查和导出插件。用户端直接提供合同工作台，支持本地草稿、模板起草、上传审查、条款编辑、风险提示和导出；Console 负责模型配置、合同模板和任务运维。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 面向用户的合同起草/审查工作台 + 管理员配置与任务运营。 |
| 用户端 | 起草、上传审查、编辑、再次审查、导出和查看任务状态。 |
| Console | 模型配置、模板管理、任务列表、失败/退款排查。 |
| 长流程 | 合同生成、上传审查、再次审查和导出走任务状态与队列，不阻塞 HTTP 请求。 |
| 上传 | 上传审查只接受平台上传返回的可信 `fileId`。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 合同起草 | ready | 用户填写行业、合同类型和关键条款后创建异步生成任务。 |
| 上传审查 | ready | 只接收平台 `fileId`，服务端校验上传者、插件归属、类型和大小。 |
| 条款编辑 | ready | 用户端保留常驻 Plate 条款编辑器和本地草稿流程。 |
| 再次审查 | ready | 已生成任务可触发再次审查，写回前校验当前任务状态。 |
| Word 导出 | ready | 导出任务写回前校验导出状态，避免覆盖其他终态。 |
| 计费退款 | ready | 使用主系统算力账本，生成前预检、任务入库后预扣、失败按账务事实退款。 |
| 队列恢复 | partial | 已有超时恢复和状态抢占逻辑；仍需真实 Redis/Worker smoke。 |
| 真实 LLM smoke | pending | 需要真实主站模型、Secret、余额和文件存储验证完整链路。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-contract-generation/` | `src/web/pages/index.tsx` | 合同起草、上传审查、编辑、导出和任务状态。 |
| Console | `/console/` | `src/web/pages/console/config.tsx` | 模型配置和基础策略。 |
| Console | `/console/templates` | `src/web/pages/console/templates.tsx` | 合同模板管理。 |
| Console | `/console/tasks` | `src/web/pages/console/tasks.tsx` | 任务列表、失败、退款和运维排查。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web | `@ExtensionWebController("contract-generation")` | 用户端起草、上传审查、任务状态、再次审查和导出。 |
| Console | `@ExtensionConsoleController("contract-generation", "AI合同管理")` | 配置、模板和任务运维。 |

关键模块：

| 模块 | 说明 |
|---|---|
| `contract-generation.module.ts` | 导入主站 AI、计费和队列能力，注册业务服务。 |
| `contract-generation.service.ts` | 任务创建、文件校验、队列入队、LLM 调用、状态写回、扣费退款和导出。 |
| `controllers/web` | 当前用户工作流，不暴露 Console 字段。 |
| `controllers/console` | 管理端配置、模板、任务和统计。 |
| `dto` | 用户端和管理端输入输出约束。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| LLM | 通过 `AiPublicModule` / `PublicAiModelService` 获取模型、Provider Config 和 adapter。 |
| Provider Config | 使用 `normalizeProviderConfig()` 读取主站 Secret 字段别名；插件不保存密钥。 |
| Billing | 使用 `ExtensionBillingService`，任务 ID 作为 `associationNo`，扣费和退款做幂等检查。 |
| Queue | 使用主系统 `QueueModule` 承载合同生成、上传审查和导出长流程。 |
| Upload | 前端复用平台上传，后端只接受当前插件可信 `fileId`。 |
| Notification | 通过 `ExtensionNotificationService` 注册合同生成成功、上传审查成功、导出成功和任务失败场景；通知失败不改变任务终态。 |
| UI | 用户端和 Console 复用主系统 Button、Card、Input、Textarea、Select、Tabs、Badge、Label 等组件。 |

## 上传与安全

| 主题 | 规则 |
|---|---|
| 文件来源 | 上传审查只接受平台 `fileId`，不接收任意外部 URL。 |
| 文件校验 | 校验上传者、`extensionIdentifier === "echoflow-contract-generation"`、MIME/扩展名和 20MB 大小上限。 |
| SSRF | 已通过平台校验的本插件上传文件可按 `/uploads/` 路径允许本地或私有化部署域名；任意外部 URL 仍拒绝本机、内网和带凭据地址。 |
| 状态写回 | 生成、上传审查、再次审查和导出成功写回前都在行锁内确认当前动作状态。 |
| 删除保护 | 处理中、审查中、导出中任务默认不能删除。 |
| 用户端返回 | 不暴露主站模型密钥、Provider 配置、管理员备注或未脱敏上游响应。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 合同任务、模板、配置、版本和导出记录使用插件实体。 |
| Migration | 首版表结构位于 `src/api/db/migrations/`，合同插件 migration 产物需进入发布包。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等写入主系统 extension 安装记录。 |
| 文件 | 上传文件通过平台记录校验；导出文件保存 URL、文件 ID 或相对路径，不把大文件/base64 放入数据库。 |
| 状态 | 任务状态区分生成、审查、导出、失败和完成，便于恢复与补偿。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 任务入库后预扣，使用任务 ID 作为 `associationNo` 避免重复扣费。
- AI 或导出失败时按账务事实退款，退款失败写入 `providerMetadata.refundError`。
- 上传审查按任务成本预扣；已生成任务的再次审查和条款改写当前按“生成后免费”策略处理。

## 开发与验证

```bash
pnpm --filter echoflow-contract-generation check-types
pnpm --filter echoflow-contract-generation build:api
pnpm --filter echoflow-contract-generation build:web
pnpm --filter echoflow-contract-generation test
pnpm --filter echoflow-contract-generation build:publish
```

`build:web` 使用 `vite --configLoader native`。若 Vite/Rolldown 在配置加载或 HTML entry 解析阶段失败，先用最小 HTML smoke 区分工具链问题与插件业务代码问题。

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实 Redis/Worker 未 smoke | 队列恢复、重复执行保护和超时补偿不能声明生产闭环。 | 覆盖入队失败、重启恢复、超时任务和软删除保护。 |
| 真实 LLM/文件存储未 smoke | 合同生成、审查、导出和退款不能声明完整联调。 | 准备主站 Secret、测试用户、余额和部署域名。 |
| 动态队列 SDK 缺口 | 当前插件注册业务队列；若主系统未来提供统一 enqueue API，应迁移。 | 保持 README 记录，避免重复封装。 |
| 文件归属边界敏感 | 上传审查不能退化成任意 URL 解析。 | 补 fileId 校验、URL 拒绝、大小和 MIME 测试。 |

## 下一步

| 优先级 | 任务 |
|---|---|
| P1 | 真实端到端 smoke：起草、上传审查、再次审查、导出、失败退款和文件归属校验。 |
| P1 | Redis/Worker smoke：入队失败、重启恢复、重复执行保护和软删除保护。 |
| P1 | 补合同生成、上传审查、DOCX 构建、文件归属和扣费幂等 focused tests。 |
| P2 | 若主系统提供动态队列统一 API，迁移当前插件队列封装。 |
| P2 | 按真实运营需求补模板审核、版本对比和导出审计。 |
