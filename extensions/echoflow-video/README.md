# EchoFlow 视频生成

`echoflow-video` 是 EchoFlow 的视频生成插件。当前按固定模型目录接入 Seedance、Kling、HappyHorse 等视频能力；用户端负责生成、历史和结果查看，Console 负责模型接入点、计费、模板、风控、提示词优化、Webhook 和任务运维。

文档维护规则：全仓公共边界、主系统二开、上游同步、组件化 UI 和验证规则维护在根目录 `AGENTS.md`；本 README 只维护 `echoflow-video` 的业务边界、能力状态、入口、异步生成/队列/计费/安全事实、验证命令和待办。临时分析、参考图说明、浏览器 QA checklist、外部项目快照或计划文档只作为施工材料，有效结论必须合并到 `AGENTS.md` 或本 README，不长期维护第二套插件规范；如果出现更好的队列、Secret、限流、视频协议或模型接入规范，也优先回写这两个长期入口，并从“下一步”移除已经落地的旧计划。

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
| `VideoGatewayClient` | 固定视频模型的统一上游协议适配、URL 安全校验和错误归一；默认网关地址来自模型 catalog，底层 JSON 请求复用 `@buildingai/extension-sdk` provider HTTP client。 |
| `PromptOptimizationService` | 主站 LLM 提示词优化。 |
| `processors/*` | 自动延迟轮询和队列处理。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| Secret | 模型接入点和 Webhook Secret 复用主站 Secret；插件不保存业务 API Key。 |
| Webhook Secret | HappyHorse Webhook 只从主站 Secret 解析期望值，缺失或错误签名只 ACK 不写业务状态；比较使用 SHA-256 digest + `timingSafeEqual`，日志不打印 Secret 或签名值。 |
| Provider Config | 通过 `normalizeProviderConfig()` 解析 `apiKey`、`baseURL`、`webhookSecret` 等别名。 |
| Base URL | 接入点保存时复用 `normalizePublicHttpUrl()` 和 `assertPublicHttpUrl()`；运行时凭据解析复用 `resolveProviderEndpointCredential()`，防止各插件重复维护公网校验。 |
| 配置输出 | Console / Web 对外返回模型、接入点或管理配置时必须白名单组装字段，不要直接展开 `config` / `resolved` / `endpoint`，避免历史字段如 `apiKeyMasked`、旧兼容键或内部排障字段泄漏。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款；退款执行异常会写入 `rawResponse.metadata.refundError` / `refundFailedAt`，用户端只展示账务事实文案。 |
| Queue | 使用主系统 `QueueModule` / BullMQ 安排自动轮询，减少用户页轮询依赖。 |
| 模型运行保护 | 内置模型不能删除；模型有 `PENDING` / `PROCESSING` 任务时，Console 不能停用、隐藏或移除全部可用接入点，避免处理中任务失去轮询和结果写回能力。 |
| 异步写回保护 | 轮询、Webhook、超时扫描和队列失败记录写回前通过事务锁重新读取记录；若记录已终态或已软删除，不再覆盖任务状态、raw 响应或状态时间线。 |
| Upload | 素材必须通过平台上传并提交 `fileId`；后端通过 `UploadModule` / `FileUploadService` 读取平台文件记录，不直接注入平台 `File` 仓储；运行时校验上传者、插件归属、软删除、大小、MIME 和平台文件 URL。 |
| Notification | 通过 `ExtensionNotificationService` 注册 `echoflow-video.generation.succeeded` / `echoflow-video.generation.failed`，由主站通知中心管理场景、模板和渠道。 |
| 构建依赖 | 已清理模板残留依赖；保留的 `@playwright/test` 只用于 e2e。依赖是否保留以是否能在源码或配置链路中找到实际用途为准。 |
| Provider HTTP | `video-http-client.ts` 只保留视频业务错误文案和薄封装；JSON 请求、timeout、retry、endpoint 测试、JSON parse 和 raw payload 压缩解析复用 `requestProviderJson` / `testProviderJsonEndpoint` / `safeJsonParse`；provider 返回的视频结果 URL 写回前复用 `assertPublicHttpUrl()` 做 DNS 解析和公网校验。 |
| 限流 | 生成和提示词优化入口使用 `ExtensionRateLimitService`，底层复用主系统 Redis 计数；不保留插件级内存 Map 或本地限流服务。 |
| 浏览器持久化 | 历史参数复用通过 `@buildingai/stores` 的 `getSessionStorage()` / `safeJsonParse()` / `safeJsonStringify()` 读写短期会话状态；插件不直接手写 `window.sessionStorage` 和 JSON 容错。 |
| Console JSON | 模板默认参数编辑器复用 `@buildingai/stores` 的 `safeJsonParse`，不在 Web 运行时代码里保留裸 `JSON.parse`。 |
| RootLayout | `main.tsx` 只挂载主系统扩展 `RootLayout`，不再重复创建 `QueryClientProvider`；页面内部缓存更新使用 `useQueryClient()` 读取宿主 query client。 |
| UI | 用户端和 Console 优先使用主系统 Button、Card、Badge、Alert、Input、Textarea、Select、Switch、Label、Checkbox、Progress、Skeleton 等组件；生成表单、Console 模型页普通字段和模板能力 checkbox 复合行均已收敛到系统 `Label`，复合行通过 `id` / `htmlFor` 保留整行点击语义；基础错误态使用系统 `Alert` / `Button` 和轻量文本符号，不在常驻路径静态引入 `lucide-react`；插件 CSS 只保留系统样式导入和无法组件化的业务排版。 |
| Manifest | `package.json` 声明运行时代码、构建配置和可运行测试资产直接 import 的包；`vite.config.ts` / `tsup.config.ts` / `eslint.config.mjs` 的 `@tailwindcss/vite`、`@vitejs/plugin-react`、`tsup`、`eslint`、`globals`，以及 `tests/e2e` 的 `@playwright/test` 不依赖根项目传递解析；`extensions/extensions.json` 的本地登记名与 `manifest.json` 保持一致。 |

## 数据与安全

| 主题 | 说明 |
|---|---|
| 任务记录 | 保存 provider、taskId、模型快照、计费快照、状态时间线、失败分类和脱敏 raw 摘要。 |
| 用户端返回 | public serializer 使用白名单字段，只返回用户可见任务、状态、账务、素材、参数和时间线；不返回 `taskId`、`adminRemark`、`rawRequest`、`rawResponse`、`billingRuleSnapshot`、`failureCategory` 或内部状态来源。 |
| 接入点 | 只保存 `secretId`、`secretName`、Base URL 覆盖、启用状态、优先级、超时和重试。 |
| Base URL 覆盖 | 保存时和运行时都拒绝本机、内网、保留地址、带凭据 URL 和非 http/https 协议；域名按 DNS 解析结果校验。 |
| URL 校验 | HappyHorse Base URL 和 provider 结果 URL 拒绝本机、内网、凭据片段和非 http/https 协议。 |
| Webhook | 未配置 Secret 时不信任公开回调；配置后校验主站 Secret 字段。 |
| 删除保护 | 模型已有任务、计费、策略或模板引用时应停用而不是删除。 |

## 配置流程

1. 在主站密钥管理创建视频服务 Secret，字段包含 `apiKey` 或 `api_key`，可选 `baseURL` / `baseUrl` / `base_url`。
2. 在 Console `/models` 为固定模型绑定一组或多组 Secret 接入点，配置用户可见性、默认参数、模型级计费、超时、重试和优先级。
3. 在 `/config` 选择提示词优化 LLM，并绑定 Webhook Secret。
4. 在 `/policies` 配置 prompt、素材、并发、用户/IP/provider/model 等风控策略。
5. 使用 `/history` 和任务详情复核提交、轮询、Webhook、失败退款、通知和状态时间线。

## 用户端体验边界

用户端首页保持嵌入式业务工作台，不做营销 Hero、独立侧边栏、头像账号、全局余额或通知设置。主系统已经提供外壳，插件只展示视频生成需要的上下文：生成方式、素材要求、提示词、扣费与失败退款说明、任务状态、结果操作和最近作品。

| 模式 | capability | 素材 |
|---|---|---|
| 文生视频 | `text_to_video` | 不需要素材。 |
| 首帧图生视频 | `first_frame_i2v` | 需要且只需要 1 张 `first_frame` 图片。 |
| 多参考图 | `reference_to_video` | 需要 1-4 张 `reference_image` 图片。 |
| 视频编辑 | `video_editing` / `action_transfer` | 需要 1 个 `video`，可按模型能力追加参考图。 |

用户端只消费 Web public 字段。历史参数复用不携带 Console 排障字段、provider 原始响应、内部失败分类或主系统模型 ID；用户端无模板配置时不展示本地默认模板。无可用视频模型时，工作台保留说明和历史入口，但生成表单整体只读，避免用户误以为可以提交。

## 开发与验证

```bash
pnpm --filter echoflow-video check-types
pnpm --filter echoflow-video build:api
pnpm --filter echoflow-video build:web
pnpm --filter echoflow-video test
pnpm --filter echoflow-video build:publish
node tests/video-public-api-boundary.test.mjs
node tests/video-manifest-boundary.test.mjs
```

| 项目 | 状态 |
|---|---|
| 类型、构建与边界测试 | 本地按上述命令验证；测试桩需随主系统 SDK 导出同步。 |
| Web public 边界 | 由 `tests/video-public-api-boundary.test.mjs` 约束 Web/Console 字段分离、RootLayout、SDK 限流、provider HTTP、public serializer 和常驻路径依赖。 |
| 发布包边界 | 由 `tests/video-manifest-boundary.test.mjs` 约束 manifest/package/registry、发布 allowlist、静态资产和运行时目录排除。 |
| 真实端到端 | 仍需真实 Secret、余额、存储、Redis/Worker 覆盖提交、轮询、Webhook、失败退款和通知。 |
| 主系统安装 | release zip 内容检查不等于安装完成；只有在主系统成功安装、迁移、重启并打开 Web/Console 后才能声明通过。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实供应商未 smoke | 当前不能声明完整生产闭环。 | 准备 Secret、余额、存储和测试素材后逐模型验证。 |
| 短视频制作 reserved | 页面存在但不是上线能力。 | 保持 reserved 文案和禁用路径，明确业务边界后再转正式功能。 |
| 队列拓扑 | 真实 Redis/Worker 未覆盖时，自动轮询可靠性不能下结论。 | 做自动延迟轮询、重启恢复、重复执行、超时和软删除 smoke。 |
| 真实上传边界 | 单测覆盖平台上传记录校验，仍需真实上传链路验证。 | 覆盖上传记录创建、归属、存储读取、历史素材重传和删除后提交。 |

## 后续完整开发任务

后续开发按“真实链路优先、发布可安装、再做体验细节”的顺序推进。每个阶段完成后把新证据更新到本 README；若发现跨插件通用规范，再同步更新根目录 `AGENTS.md`，不另起长期文档。

### P1：真实端到端 smoke

| 任务 | 范围 | 具体步骤 | 验收 |
|---|---|---|---|
| 配置真实运行环境 | 主站 Console、Secret、测试用户、余额、Redis、存储 | 准备视频服务 Secret、Webhook Secret、测试用户余额、平台上传目录和 Redis Worker；确认 `echoflow-video` 已安装且 Console 可打开。 | 记录环境条件；缺 Secret、余额或 Redis 时不进入真实闭环验收。 |
| 文生视频提交 | Web 工作台、`GenerationService`、provider client | 用一个 P0 文生模型提交 prompt，确认创建记录、预扣、入队、provider 返回 taskId、前端进入处理中。 | 用户端不暴露 taskId/raw response；Console 可看到脱敏排障字段。 |
| 图生/多参考图提交 | 平台上传、素材校验、Web 工作台 | 通过平台上传真实图片，分别验证首帧图生视频和多参考图；覆盖历史素材需重传路径。 | 上传归属、插件归属、MIME、大小和软删除校验在 provider 提交前生效。 |
| 轮询成功写回 | BullMQ processor、状态查询、结果 URL 校验 | 等待自动延迟轮询拿到成功结果，确认 result URL 通过公网/DNS 校验后写回。 | 用户端播放/下载/复制/复用可用；详情页与首页状态一致。 |
| Webhook 成功写回 | `webhook.controller.ts`、Webhook Secret | 使用真实或可复现的 provider 回调，验证签名正确时写成功，签名缺失/错误时只 ACK 不写业务状态。 | 日志不打印 Secret/签名；旧终态不会被覆盖。 |
| 失败退款 | 计费、provider 失败、退款 metadata | 触发可控失败或模拟 provider 失败，确认失败状态、退款事实、退款异常 metadata 和用户端文案。 | 只按账务事实展示“已退款/等待核对/退款异常”，不承诺未验证闭环。 |
| 通知投递 | 主站通知中心 | 成功和失败终态各触发一次 `echoflow-video.generation.*` 通知。 | 主站通知记录可查；投递失败只记录 skipped/failed，不回滚视频任务。 |

验证命令和证据：端到端 smoke 后至少补充 `corepack pnpm --filter echoflow-video test`、`corepack pnpm --filter echoflow-video build:api`、`corepack pnpm --filter echoflow-video build:web`，并记录真实任务 ID、状态、账务事实和通知记录的脱敏摘要。

### P1：Redis/Worker 拓扑 smoke

| 任务 | 范围 | 具体步骤 | 验收 |
|---|---|---|---|
| 自动延迟轮询 | `processors/*`、BullMQ | 提交任务后关闭用户页面，只靠 Worker 轮询推进状态。 | 不依赖前端长轮询也能完成或失败。 |
| 重启恢复 | API 服务、Worker、Redis | 任务处于 `PROCESSING` 时重启服务和 Worker，确认恢复扫描或延迟任务继续推进。 | 不重复扣费，不重复终态通知。 |
| 重复执行保护 | Webhook、手动刷新、Worker | 对同一任务并发触发刷新、Webhook 和 Worker 轮询。 | 只有第一次合法终态写回；后续旧对象不覆盖 raw 响应、状态和账务。 |
| 超时回收 | 超时扫描、失败分类 | 配置短超时任务，确认超时写失败和退款逻辑。 | 失败类型可在 Console 排查，用户端文案稳定。 |
| 软删除保护 | 删除接口、异步写回 | 任务软删除后触发队列失败、轮询或 Webhook。 | 已删除记录不再被异步流程改回可见状态。 |

阻塞条件：没有真实 Redis/Worker 或没有可控 provider 任务时，只能声明本地单测覆盖，不能声明拓扑 smoke 通过。

### P1：发布包安装 smoke

| 任务 | 范围 | 具体步骤 | 验收 |
|---|---|---|---|
| 发布构建 | 插件目录 | 运行 `corepack pnpm --filter echoflow-video build:publish`。 | `.output/public/index.html`、拆分 JS/CSS、`build/index.js` 和 `build/index.d.ts` 存在。 |
| release zip | 已落地：`pnpm extension:release`、`packages/cli/src/commands/extension.js` 白名单 | 按当前版本生成 release zip，检查 zip 中只包含 `.output`、`build`、`src`、`storage/static`、`storage/.gitkeep`、`manifest.json`、`package.json`、`README.md`、构建配置和允许文件。 | 本地 zip 已生成并通过内容检查；三张设计参考图位于 `storage/static/design`；运行时上传、测试目录和 `node_modules` 不进入发布包。 |
| 安装路径 | 主系统安装环境 | 通过主系统安装 release zip，确认版本识别、manifest 读取、migration/upgrade 执行、服务重启和 Web/Console 页面可打开；升级验证主系统保留 `data`、`storage` 整目录。 | 未完成真实安装前不能声明通过；完成后记录脱敏安装证据。 |
| 重启验证 | 待真实安装环境：API、Web、Worker | 安装后重启服务，打开用户端和 Console。 | 页面可打开，历史数据保留，队列任务不丢失。 |

本插件 release 事实以 BuildingAI CLI 白名单为准，不以 `package.json.files` 判断发布内容。

### P2：体验与体积继续优化

| 任务 | 文件 | 开发要求 | 验收 |
|---|---|---|---|
| 共享 chunk 审查 | Web build 输出、`src/web/routes.tsx`、Console 组件 | 继续观察主入口、`card`/共享 UI chunk 和 CSS 体积；只在有明确收益时拆分 Console 专属组件或优化懒加载。 | `build:web` 无本插件主 chunk 超 500 kB 警告；体积变化记录在 README。 |
| CSS 最小化 | `src/web/styles/index.css`、Web 组件 | 继续删除可由 UI 组件、`cn()` 和 Tailwind 工具类表达的插件 CSS；保留媒体画布、素材槽和响应式兜底。 | 不新增大段插件级 token、按钮、Tabs、Badge 或表单样式；浏览器桌面/移动无错位。 |
| 用户文案打磨 | `generation-form.tsx`、`video-result.tsx`、`history-list.tsx`、`detail.tsx` | 文案围绕异步生成、素材校验、扣费时机、失败退款、结果复用；避免泛 AI 口号和 provider 运维术语。 | 无模型、处理中、成功、失败、退款异常五类状态均可被普通用户理解。 |
| Browser 回归 | Browser/IAB | 在主系统插件容器或等价本地路由检查桌面和 390px 移动端。 | 无页面级横向溢出、文本遮挡、console error/warn；等待 Suspense 结束后再截图判断。 |

### P2：安全与边界补强

| 任务 | 范围 | 要求 | 验收 |
|---|---|---|---|
| 真实上传 smoke | 平台上传、`normalizeAndValidateMedia()` | 覆盖真实上传记录创建、归属、存储读取、历史素材重传和删除后提交。 | 与现有行为测试一致，provider 提交前拦截非法素材。 |
| provider URL 联调 | provider client、结果写回 | 用真实供应商 URL 覆盖 http(s)、跳转、DNS、公网校验和失败错误。 | 私网、本机、凭据 URL 不写入结果；失败可在 Console 排查。 |
| 签名联调 | Webhook Secret | 覆盖真实 provider 签名算法、错误签名、重复回调和缺 Secret。 | 常量时间比较路径可用；日志脱敏。 |
| Public serializer 回归 | Web API、Console API | 每次新增字段后跑 public 边界测试并人工抽查响应。 | Web 不返回 `secretId`、Base URL、API Key、taskId、raw request/response 或 admin note。 |

### P3：短视频制作 reserved 转正式前置

| 任务 | 范围 | 启动条件 | 验收 |
|---|---|---|---|
| 用户工作流设计 | Web `studio`、Console `studio` | 明确短视频制作是素材编排、脚本分镜、批量生成、剪辑导出还是模板化发布。 | README 先记录业务边界；未明确前继续 reserved。 |
| 数据与存储设计 | API entity、migration、uploads | 明确项目、片段、素材、导出文件和运行时存储路径。 | 不把大文件/base64 存数据库；上传仍走平台文件。 |
| 计费与队列设计 | 计费、Worker、失败退款 | 明确按片段、按导出、按总时长或按模型计费。 | 入队失败、部分失败、退款和重试规则可审计。 |
| Console 运维 | Console 页面 | 明确模板、任务、失败、素材和导出排障字段。 | 不暴露用户端 Secret/provider 原始响应。 |

短视频制作未完成上述前置任务前，Web 和 Console 只保留 reserved 文案与弱入口，不能作为默认主功能展示。
