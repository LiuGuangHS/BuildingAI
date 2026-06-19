# AI 视频工作台

`echoflow-video` 是 EchoFlow 的视频生成插件。当前按固定模型目录接入 Seedance、Kling、HappyHorse 等视频能力；用户端负责生成、历史和结果查看，Console 负责模型接入点、计费、模板、风控、提示词优化、Webhook 和任务运维。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 用户视频创作台 + 管理员视频运营台。 |
| 模型来源 | 插件内置固定模型 catalog，管理员不新增协议模型或供应商。 |
| 密钥来源 | 每个模型维护一组或多组主站 Secret 接入点，插件只保存引用和运行参数。 |
| 计费 | 模型级计费规则随固定模型配置维护；独立计费页不作为默认维护入口。 |
| 长流程 | 提交成功后通过主系统 `QueueModule` / BullMQ 安排自动延迟轮询，Webhook 和手动刷新走同一终态保护。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生视频/图生视频 | ready | 根据固定模型能力收敛用户端参数和素材要求。 |
| 模型目录 | ready | Seedance、Kling、HappyHorse 等 P0 模型由 catalog 维护协议和 capability。 |
| 多接入点 | ready | 每个模型可绑定多组主站 Secret，支持优先级、超时、重试和 Base URL 覆盖。 |
| 模型级计费 | ready | 按模型基础费用、时长、分辨率倍率和失败退款配置预估与扣费。 |
| 提示词优化 | ready | 复用主站 LLM，优化扣费读取主站模型 `billingRule`。 |
| Webhook | ready | Webhook Secret 通过主站 Secret 引用，字段支持 `webhookSecret` / `secret` / `token`。 |
| 终态保护 | ready | Webhook、轮询、超时扫描和取消写回前重新加锁；已终态记录不被旧对象覆盖。 |
| 主站通知 | ready | 视频终态通知提交到主站通知中心，由平台多渠道投递。 |
| 短视频制作 | reserved | Web/Console 均保留页面入口，但当前不是默认上线能力。 |
| 真实供应商 smoke | pending | 仍需使用真实 Secret 覆盖提交、轮询、Webhook、失败退款和结果转存。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-video/` | `src/web/pages/index.tsx` | 视频生成工作台。 |
| Web | `/extension/echoflow-video/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Web | `/extension/echoflow-video/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Web | `/extension/echoflow-video/studio` | `src/web/pages/studio.tsx` | 短视频制作 reserved 入口。 |
| Console | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console | `/console/models` | `src/web/pages/console/models.tsx` | 固定模型、接入点和模型级计费。 |
| Console | `/console/policies` | `src/web/pages/console/policies.tsx` | 风控限流。 |
| Console | `/console/templates` | `src/web/pages/console/templates.tsx` | 模板预设。 |
| Console | `/console/history` | `src/web/pages/console/history.tsx` | 全量任务历史。 |
| Console | `/console/config` | `src/web/pages/console/config.tsx` | LLM 与回调 Secret。 |
| Console | `/console/studio` | `src/web/pages/console/studio.tsx` | 短视频制作 reserved 管理入口。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web generation | `@ExtensionWebController("generation")` | 创建生成、查询任务、刷新状态。 |
| Web billing | `@ExtensionWebController("billing")` | 用户端生成费用预估。 |
| Web templates | `@ExtensionWebController("templates")` | 用户端模板读取。 |
| Web webhook | `@ExtensionWebController("webhook")` | Provider 回调入口。 |
| Console generation | `@ExtensionConsoleController("generation")` | 全量任务、详情、运维操作。 |
| Console models | `@ExtensionConsoleController("models")` | 固定模型配置和接入点。 |
| Console billing-rules | `@ExtensionConsoleController("billing-rules")` | 模型计费规则。 |
| Console policies | `@ExtensionConsoleController("policies")` | 风控策略。 |
| Console templates | `@ExtensionConsoleController("templates")` | 模板管理。 |
| Console config | `@ExtensionConsoleController("config")` | 提示词优化模型与 Webhook Secret。 |

关键服务：

| 服务 | 说明 |
|---|---|
| `GenerationService` | 任务创建、余额预检、预扣、提交、轮询、Webhook 写回、退款和 public serializer。 |
| `ModelConfigService` | 固定模型 catalog、用户可见性、接入点和 capability 收敛。 |
| `ProviderConfigService` | 提示词优化模型、Webhook Secret 和配置审计。 |
| `VideoGatewayClient` / `HappyHorseClient` | 上游协议适配、URL 安全校验和错误归一。 |
| `PromptOptimizationService` | 主站 LLM 提示词优化。 |
| `processors/*` | 自动延迟轮询和队列处理。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| Secret | 模型接入点和 Webhook Secret 复用主站 Secret；插件不保存业务 API Key。 |
| Provider Config | 通过 `normalizeProviderConfig()` 解析 `apiKey`、`baseURL`、`webhookSecret` 等别名。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款。 |
| Queue | 使用主系统 `QueueModule` / BullMQ 安排自动轮询，减少用户页轮询依赖。 |
| Upload | 素材优先通过平台上传并提交 `fileId`；外部 URL 仍保留 SSRF 防护。 |
| Notification | 通过 `ExtensionNotificationService` 注册 `echoflow-video.generation.succeeded` / `echoflow-video.generation.failed`，由主站通知中心管理场景、模板和渠道。 |
| 限流 | 生成和提示词优化入口使用 `VideoRequestLimiterService`，底层复用主系统 Redis 计数；不保留插件级内存 Map 限流。 |
| UI | Console 按钮、开关、复选、模板能力选择和模型列表选择使用主系统组件。 |

## 数据与安全

| 主题 | 说明 |
|---|---|
| 任务记录 | 保存 provider、taskId、模型快照、计费快照、状态时间线、失败分类和脱敏 raw 摘要。 |
| 用户端返回 | public serializer 剥离 `taskId`、`adminRemark`、`rawRequest`、`rawResponse` 和 `billingRuleSnapshot`。 |
| 接入点 | 只保存 `secretId`、`secretName`、Base URL 覆盖、启用状态、优先级、超时和重试。 |
| URL 校验 | HappyHorse Base URL 和 provider 结果 URL 拒绝本机、内网、凭据片段和非 http/https 协议。 |
| Webhook | 未配置 Secret 时不信任公开回调；配置后校验主站 Secret 字段。 |
| 删除保护 | 模型已有任务、计费、策略或模板引用时应停用而不是删除。 |

## 配置流程

1. 在主站密钥管理创建视频服务 Secret，字段包含 `apiKey` 或 `api_key`，可选 `baseURL` / `baseUrl` / `base_url`。
2. 在 Console `/models` 为固定模型绑定一组或多组 Secret 接入点，配置用户可见性、默认参数、模型级计费、超时、重试和优先级。
3. 在 `/config` 选择提示词优化 LLM，并绑定 Webhook Secret。
4. 在 `/policies` 配置 prompt、素材、并发、用户/IP/provider/model 等风控策略。
5. 使用 `/history` 和任务详情复核提交、轮询、Webhook、失败退款、通知和状态时间线。

## 开发与验证

```bash
pnpm --filter echoflow-video check-types
pnpm --filter echoflow-video build:api
pnpm --filter echoflow-video build:web
pnpm --filter echoflow-video test
pnpm --filter echoflow-video build:publish
```

当前验证缺口：

| 项目 | 状态 |
|---|---|
| 类型检查与单测 | package 脚本为 `pnpm run check-types && pnpm run test:unit`，测试桩需保持主系统 SDK 导出同步。 |
| Web 构建 | 本机曾复现 Vite/Rolldown HTML entry 解析问题；发布前需重新验证。 |
| 真实端到端 | 需要真实主站 Secret 覆盖 Seedance、Kling、HappyHorse P0 模型提交、轮询、Webhook、失败退款和结果转存。 |
| Redis/Worker | 需要 smoke 自动延迟轮询、多实例重启恢复、超时扫描和终态短路。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实供应商未 smoke | 当前不能声明完整生产闭环。 | 准备 Secret、余额、存储和测试素材后逐模型验证。 |
| 短视频制作 reserved | 页面存在但不是上线能力。 | 保持 reserved 文案和禁用路径，避免误导用户。 |
| 多供应商扩展 | 非 HappyHorse 供应商适配仍需逐协议验证。 | 新 provider 接入前补协议 capability、URL 安全和状态映射测试。 |
| 队列拓扑 | 真实 Redis/Worker 未覆盖时，自动轮询可靠性不能下结论。 | 做重启恢复、重复入队、超时和终态竞态 smoke。 |

## 下一步

| 优先级 | 任务 |
|---|---|
| P1 | 真实模型端到端 smoke：提交、轮询、Webhook、失败退款、结果转存和通知。 |
| P1 | Redis/Worker 拓扑 smoke：自动延迟轮询、重启恢复、重复执行保护和超时回收。 |
| P1 | 重新验证 `build:web` / `build:publish`，确认 Vite/Rolldown 阻塞是否仍存在。 |
| P2 | 补 provider 结果 URL、Webhook Secret、失败退款、模型删除保护和 public serializer 测试。 |
| P2 | 短视频制作从 reserved 进入正式路线前，先明确用户工作流、计费、素材存储和 Console 运维边界。 |
