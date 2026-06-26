# AI 合同生成与审查

`echoflow-contract-generation` 是 EchoFlow 的合同起草、审查和导出插件。用户端直接提供合同工作台，支持本地草稿、模板起草、上传审查、条款编辑、风险提示和导出；Console 负责模型配置、合同模板和任务运维。

文档维护规则：全仓公共边界、主系统二开、上游同步、组件化 UI 和验证规则维护在根目录 `AGENTS.md`；本 README 只维护 `echoflow-contract-generation` 的业务边界、能力状态、入口、合同工作台/队列/计费/上传安全事实、验证命令和待办。临时分析、浏览器 QA checklist、外部项目快照或计划文档只作为施工材料，有效结论必须合并到 `AGENTS.md` 或本 README，不长期维护第二套插件规范；新的合同上传、计费、LLM、导出或风险审查规范也直接沉淀到这两处，并从“下一步”移除已经落地的旧计划。

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
| 事务锁超时 | ready | 所有写操作事务开头执行 `SET LOCAL lock_timeout = 3000`，通过文件级常量 `LOCK_TIMEOUT` 统一管理。 |
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复扫描，事务内悲观锁+CAS二次校验防止多实例重复入队；Webhook/轮询/导出写回前在锁内校验当前状态，已终态记录不被旧结果覆盖。 |
| Service 继承 | ready | ContractGenerationService 继承 BaseService，复用 withTransaction 等通用能力。 |
| 错误处理 | ready | 业务校验失败使用 HTTP 异常，Controller 层无 try/catch 吞异常。 |
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

## 用户端 AI 工作台

用户端页面运行在主系统插件容器内，只呈现合同业务工作台，不重复主系统导航、账号、头像、全局统计、模型管理、Provider、Secret 或原始上游响应。

- 顶部：当前合同任务、AI 信号和任务状态。
- 左侧：起草/审查输入、AI 依据、缺失事实、上传和主动作。
- 中间：合同正文画布、条款目录、AI 条款标记和保存。
- 右侧：风险、改写、版本和导出四个上下文面板。

AI 能力通过可观察业务信号呈现：识别事实、缺失事实、条款数量、高风险数量、来源条款、风险置信度、改写建议、价格组预扣和失败退款状态。

实现约定：

- 用户端首屏必须保持嵌入式插件面板形态，不做独立应用外壳、营销 Hero、全局侧边栏或账号区。
- 普通控件和布局优先复用 BuildingAI UI 组件、`cn()` 和 Tailwind 工具类；手写 CSS 只保留给合同纸张、Plate 正文编辑器、AI 条款标记和无法由组件库稳定表达的局部排版。
- 模板和最近合同放在抽屉内，不长期占用首屏空间；首屏只放当前合同输入、正文、风险/改写/版本/导出上下文。
- 本地 Vite 独立预览可能出现主系统 API/session 不可用导致的 `Network Error` toast；最终视觉 QA 需要在真实主系统插件容器内复核账号态、API 数据、全局 toast 和主题变量。

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
| LLM | 通过 `AiPublicModule` / `PublicAiModelService` 获取启用 LLM 并调用 `generateText()`；合同业务层不直接读取 Provider adapter 或 Secret。 |
| Provider Config | 由 `PublicAiModelService` 在主系统边界内复用 Provider/Secret 归一化；插件只保存主站模型 ID，不重复拉取或归一化 Provider 配置。 |
| 配置输出 | Console 对外返回模型或管理配置时必须白名单组装字段，不要直接展开 `config` / `resolved` / `endpoint`，避免历史字段如 `apiKeyMasked`、旧兼容键或内部排障字段泄漏。 |
| Billing | 使用 `ExtensionBillingService`，任务 ID 作为 `associationNo`，扣费和退款做幂等检查。 |
| Queue | 使用主系统 `QueueModule` 承载合同生成、上传审查和导出长流程。 |
| Rate Limit | 用户端合同起草、上传审查、再次审查、条款改写和导出复用 `ExtensionRateLimitService` + 主系统 Redis 做 10 秒/分钟双窗口限流。 |
| Upload | 前端复用平台上传，后端只接受当前插件可信 `fileId`，并通过 `UploadModule` / `FileUploadService` 读取平台文件记录，不直接注入平台 `File` 仓储；平台 `/uploads/` 路径在 fileId、上传者、插件归属、大小和 MIME 校验后放行，非平台文件 URL 解析前必须走 `assertPublicHttpUrl()` DNS 公网校验。 |
| Notification | 通过 `ExtensionNotificationService` 注册合同生成成功、上传审查成功、导出成功和任务失败场景；通知失败不改变任务终态。 |
| 构建依赖 | 已清理模板残留依赖；依赖是否保留必须能在源码、`vite`、`tsconfig` 或测试配置中找到实际用途。 |
| UI | 用户端和 Console 复用主系统 Button、Card、Input、Textarea、Select、Tabs、Badge、Label、Alert、Skeleton 等组件；手写 CSS 只留给合同纸张、Plate 正文编辑器、AI 条款标记和无法由组件库稳定表达的局部排版。 |
| Console JSON | 合同模板高级字段 JSON 编辑器复用 `@buildingai/stores` 的 `safeJsonParse`，不在 Web 运行时代码里保留裸 `JSON.parse`。 |
| RootLayout / React Query | `src/web/main.tsx` 只挂主系统扩展 `RootLayout`，不再自建 `QueryClientProvider`；Web/Console hooks 复用 RootLayout 提供的查询上下文。 |
| 路由分包 | `src/web/routes.tsx` 中 Web 首页和 3 个 Console 页面均使用 React lazy + 主系统 `Skeleton` 兜底；Console 配置、模板和任务页不静态进入默认路由模块。 |
| 编辑器分包 | 用户端合同正文区域通过 React lazy 加载 `ContractDocumentWorkbench`，Plate 编辑器和正文转换能力不再静态进入页面首段逻辑；加载态使用主系统 `Skeleton`。 |

依赖边界：API 模块直接 import `express` 的 `Request` 类型，Console JSON 编辑器直接 import `@buildingai/stores`，因此插件 `package.json` 显式声明 `express: catalog:api` 和 `@buildingai/stores: workspace:*`；不要依赖根 workspace 或其他插件的偶然传递依赖。

## 上传与安全

| 主题 | 规则 |
|---|---|
| 文件来源 | 上传审查只接受平台 `fileId`，不接收任意外部 URL。 |
| 文件校验 | 校验上传者、`extensionIdentifier === "echoflow-contract-generation"`、MIME/扩展名和 20MB 大小上限。 |
| SSRF | 已通过平台校验的本插件上传文件可按 `/uploads/` 路径允许本地或私有化部署域名；任意外部 URL 仍拒绝本机、内网和带凭据地址，并在解析前用主系统 `assertPublicHttpUrl()` 做 DNS 公网校验。 |
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

前端体验改动的最小验证：

- Node 测试覆盖 view-model、public/admin 类型边界、AI 推理文案、路由分包、RootLayout 查询上下文、Web 高成本入口 SDK 限流和 CSS/source 边界。
- Web 构建验证 Tailwind 工具类、BuildingAI UI 组件和 Vite 打包。
- Windows 环境优先使用根目录 `pnpm --filter echoflow-contract-generation ...` 命令；若工具链失败，记录当前命令、错误和是否属于插件代码。
- 浏览器检查至少覆盖当前嵌入式宽度和一个移动宽度：首屏应为任务条、输入栏、合同正文、上下文 Inspector；不得出现主系统导航/账号/全局统计/Provider/Secret/原始响应。
- 临时计划和 QA checklist 不作为长期文档保留；有效结论合并回本 README。

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实 Redis/Worker 未 smoke | 队列恢复、重复执行保护和超时补偿不能声明生产闭环。 | 覆盖入队失败、重启恢复、超时任务和软删除保护。 |
| 真实 LLM/文件存储未 smoke | 合同生成、审查、导出和退款不能声明完整联调。 | 准备主站 Secret、测试用户、余额和部署域名。 |
| 动态队列 SDK 缺口 | 当前插件注册业务队列；若主系统未来提供统一 enqueue API，应迁移。 | 保持 README 记录，避免重复封装。 |
| 文件归属边界敏感 | 上传审查不能退化成任意 URL 解析。 | 补 fileId 校验、URL 拒绝、大小和 MIME 测试。 |
| Web 主入口偏大 | Console 页面和 Plate 正文编辑器已 lazy 拆出；用户端工作台的输入、Inspector 和状态编排仍在主入口，仍需复验 chunk warning。 | 后续按生成、审查或 Inspector 重组件继续拆分懒加载，复验 chunk warning。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实端到端 smoke | Web 合同工作台、上传、队列、计费、导出 | 准备主站 Secret、测试用户、余额和文件存储，覆盖起草、上传审查、再次审查、导出、失败退款和文件归属校验。 | 记录脱敏任务 ID、fileId、账务事实和导出文件；非法 fileId、错误 MIME、越权文件在提交模型前被拦截。 |
| P1 Redis/Worker smoke | BullMQ 队列、恢复扫描、软删除保护 | 覆盖入队失败、服务重启恢复、重复执行保护、超时补偿和软删除保护。 | 不重复扣费、不覆盖终态；Console 任务页能排查失败和退款异常。 |
| P1 Focused tests 补强 | `tests/*`、合同 service、DOCX builder、上传边界 | 补合同生成、上传审查、DOCX 构建、文件归属和扣费幂等 focused tests。 | 测试覆盖 public serializer、文件归属、扣费 associationNo 和导出写回保护。 |
| P2 队列 SDK 迁移评估 | 当前插件队列封装、主系统动态队列 API | 若主系统提供动态队列统一 API，迁移当前插件队列封装并删除重复代码。 | 迁移后 README 记录新边界；入队失败和恢复 smoke 仍通过。 |
| P2 运营能力补强 | Console 模板、版本、导出审计 | 按真实运营需求补模板审核、版本对比和导出审计。 | 用户端不暴露审核内部字段；Console 能追溯模板版本、导出来源和失败原因。 |
