# 图像工作台

`echoflow-image` 是 EchoFlowAI 的图像工作台插件。用户端专注于生成、编辑和优化图片，适合封面、海报与营销素材；Console 端负责固定模型配置、接入点、模型级计费、风控策略、模板和全量历史排障。

文档维护规则：全仓公共边界、主系统二开、上游同步、组件化 UI 和验证规则维护在根目录 `AGENTS.md`；本 README 只维护 `echoflow-image` 的业务边界、能力状态、入口、图像协议/画布/计费/安全事实、验证命令和待办。临时分析、参考图说明、浏览器 QA checklist、外部项目快照或计划文档只作为施工材料，有效结论必须合并到 `AGENTS.md` 或本 README，不长期维护第二套插件规范；如果出现更好的组件约束、验证方法、图像协议或安全边界，也直接并回这两个长期入口，并从“下一步”移除已经落地的旧计划。

## 定位

| 维度 | 边界 |
|---|---|
| 产品形态 | 主系统内的嵌入式绘画插件，不是独立完整应用。 |
| 用户端 | 首屏直接展示创作工作区，不做营销页、独立 App Header、账号信息、全局统计或侧边栏。 |
| Console | 管理员配置模型、计费、风控、模板和历史排障。 |
| 模型来源 | 使用固定图像模型 catalog，协议和 capability 由代码维护。 |
| 协议 | 支持 `responses`、`images`、`openai-compatible-images` 等请求合同。 |
| 画布 | `tldraw` 用作灵感白板、批注、拼贴、参考整理和导出，不承担节点式生成内核。 |
| 计费 | 生成前预估和预扣，失败按账务事实退款；前端不硬编码价格。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生图 | ready | 按模型协议、默认参数、允许参数和模型级计费生成。 |
| 参考图生成 | ready | 支持平台 `fileId` 和经过安全校验的 http(s) 参考图。 |
| 多协议 capability | ready | Responses 不暴露 mask；Images 不暴露图生图、mask、多参考图；OpenAI-compatible Images 的参考图和 mask 走 edits 能力。 |
| 模型接入点 | ready | 每个固定模型可绑定多组主站 Secret，支持优先级、超时、重试和 Base URL 覆盖。 |
| 模型级计费 | ready | 生成前预估和预扣，失败按模型规则退款。 |
| 提示词润色 | ready | 用户端传当前绘画模型 ID；插件读取该绘画模型绑定的主站 LLM，再通过 `PublicAiModelService.generateText()` 润色。 |
| 风控策略 | ready | prompt 长度、张数、参考图、并发、每日额度等策略由 Console 维护。 |
| 模板预设 | ready | Web 可读取模板，Console 可管理模板。 |
| 无限画布 | ready | 白板草稿保存在本地浏览器，生成结果可整理到画布。 |
| 局部重绘 | reserved | 旧轻量遮罩画布已下线，后续并入完整画布工作流。 |
| 事务锁超时 | ready | 所有写操作事务开头执行 `SET LOCAL lock_timeout = 3000`，通过文件级常量 `LOCK_TIMEOUT` 统一管理。 |
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复 + `@Cron("*/5 * * * *")` 定时 stale 扫描双路径，事务内悲观锁+CAS二次校验防止多实例重复入队。 |
| Service 继承 | ready | GenerationService 继承 BaseService，复用 withTransaction 等通用能力。 |
| 错误处理 | ready | 业务校验失败使用 HTTP 异常，Controller 层无 try/catch 吞异常。 |
| 真实外部模型 smoke | pending | 需要真实 Secret 覆盖生成、失败退款和结果转存。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-image/` | `src/web/pages/index.tsx` | 生成模式与无限画布工作台。 |
| Web | `/extension/echoflow-image/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Web | `/extension/echoflow-image/history/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Console | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console | `/console/models` | `src/web/pages/console/models.tsx` | 固定模型、接入点、默认参数和模型级计费。 |
| Console | `/console/policies` | `src/web/pages/console/policies.tsx` | 风控限流。 |
| Console | `/console/templates` | `src/web/pages/console/templates.tsx` | 模板预设。 |
| Console | `/console/history` | `src/web/pages/console/history.tsx` | 全量生成历史。 |
| Console | `/console/history/:id` | `src/web/pages/console/detail.tsx` | 管理端任务详情与脱敏 raw 摘要。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web generation | `@ExtensionWebController("generation")` | 创建生成、查询状态、历史详情和 public serializer。 |
| Web billing | `@ExtensionWebController("billing")` | 用户端费用预估。 |
| Web templates | `@ExtensionWebController("templates")` | 用户端模板读取。 |
| Web model-options | `@ExtensionWebController("model-options")` | 用户端可见模型与能力选项。 |
| Console generation | `@ExtensionConsoleController("generation")` | 全量历史和管理详情。 |
| Console model-configs | `@ExtensionConsoleController("model-configs")` | 固定模型配置、接入点、默认参数和能力收敛。 |
| Console billing-rules | `@ExtensionConsoleController("billing-rules")` | 模型计费规则。 |
| Console policies | `@ExtensionConsoleController("policies")` | 风控策略。 |
| Console templates | `@ExtensionConsoleController("templates")` | 模板管理。 |

| 服务 | 说明 |
|---|---|
| `GenerationService` | 请求幂等、余额预检、预扣、协议分发、状态写回、失败退款和结果序列化。 |
| `ModelConfigService` | 固定模型 catalog、接入点、用户可见性、默认参数、提示词润色 LLM 绑定和 capability 收敛。 |
| `image-model-catalog.ts` | 模型协议、能力、默认配置和默认模型网关 Base URL 的唯一来源。 |
| `openai-image-client.ts` | Responses / Images / compatible Images 协议组装；默认 Base URL 只引用 catalog 常量，不在协议 client 内重复硬编码。 |
| `image-http-client.ts` | 复用 `@buildingai/extension-sdk` provider HTTP client 发起模型请求，并复用 `downloadPublicHttpUrl()` 完成参考图 DNS 绑定下载、重定向、超时和大小截断；插件内只保留图片 MIME、文件名和图像业务错误文案。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| Secret | 接入点复用主站 Secret；插件只保存 `secretId`、`secretName` 和运行参数。 |
| Provider Config | 通过 `normalizeProviderConfig()` 解析 `apiKey`、`baseURL` 等别名。 |
| Base URL | 接入点保存、测试和运行时复用 `@buildingai/extension-sdk` 的 `normalizePublicHttpUrl` / `assertPublicHttpUrl` / `normalizeProviderBaseUrl`；provider 默认值只维护在 `image-model-catalog.ts`。 |
| 配置输出 | Console / Web 对外返回模型、接入点或管理配置时必须白名单组装字段，不要直接展开 `config` / `resolved` / `endpoint`，避免历史字段如 `apiKeyMasked`、旧兼容键或内部排障字段泄漏。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款；退款执行异常会写入 `rawResponse.metadata.refundError` / `refundFailedAt`，用户端只展示账务事实文案。 |
| Prompt 润色 | 每个绘画模型可绑定一个主站已启用 LLM 作为 `promptEnhancerModelId`；Web 入口不直接传 LLM ID，不调用图片 provider 做文本润色，也不在失败时伪造本地润色成功。 |
| Upload / Storage | 参考图优先使用平台 `fileId`；带 `fileId` 的平台上传路径以后端平台文件记录为准，不持久化客户端同时提交的参考图 URL；外部参考图/遮罩图 URL 保存或交给 provider 前使用 `assertPublicHttpUrl()` 做 DNS 公网校验；provider 返回的远程结果 URL 写入前同样走 DNS 公网校验，base64 结果通过主系统 `FileStorageService.saveBuffer()` 写入本插件 `storage/uploads`。 |
| Notification | 通过 `ExtensionNotificationService` 注册图片生成成功、失败和超时失败场景；通知失败不回滚生成任务状态。 |
| Rate Limit | Web 生成和提示词润色入口复用 `ExtensionRateLimitService` + 主系统 Redis 做 10 秒/分钟双窗口限流；Console 策略中的并发和每日额度继续负责业务资格控制。 |
| 构建依赖 | 已清理模板残留依赖；依赖保留以实际源码或配置链路为准，不保留没有被 `vite` / `tsconfig` / 测试引用的脚手架包。 |
| HTTP | 上游 JSON/text 请求和 raw payload 压缩解析复用 `requestProviderText` 和 `safeJsonParse`；外部参考图底层下载复用 `downloadPublicHttpUrl()`，图片插件只保留 MIME、文件名、状态码和业务错误文案。 |
| SDK Helper | `openai-image-client.ts` 直接从 `@buildingai/extension-sdk/utils/pure` 引用 `safeJsonParse` / `buildDefinedWhere`；`image-http-client.ts` 只作为图片协议薄封装，不承担 SDK helper 转口。 |
| Console JSON | 模型默认参数、允许参数和模板默认参数编辑器复用 `@buildingai/stores` 的 `safeJsonParse`，不在 Web 运行时代码里保留裸 `JSON.parse`。 |
| UI | 优先复用 `@buildingai/ui/components/ui/*` 和主系统工具类；Console 模型页普通字段、开关和计费配置标签已收敛到系统 `Label`，插件 CSS 只负责画布、媒体预览、业务分组、特殊状态和响应式；基础错误态使用系统 `Alert` / `Button` 和轻量文本符号，不在常驻路径静态引入 `lucide-react`。 |
| RootLayout / React Query | `src/web/main.tsx` 只挂主系统扩展 `RootLayout`，不再自建 `QueryClientProvider`；`src/web/services/index.ts` 只聚合业务 hooks，不再导出插件私有 `queryClient`。 |
| Manifest | `package.json` 显式声明源码、Console JSON 编辑器和构建脚本直接 import 的包；`@buildingai/stores` 和 `scripts/build-web.mjs` 直接使用的 `vite` 不依赖根项目传递解析。 |

## 数据与安全

| 主题 | 说明 |
|---|---|
| 用户端返回 | Web API 返回生成记录时剥离 `rawRequest`、`rawResponse`、`rawEvents`、`baseURL` 和管理员排障字段。 |
| Console 详情 | 可保留脱敏 raw 摘要，用于排障。 |
| 接入点 | 不保存业务 API Key 明文或密文副本。 |
| Base URL 覆盖 | 保存时和运行时都拒绝本机、内网、保留地址、带凭据 URL 和非 http/https 协议。 |
| 外部参考图 | 生产默认建议关闭外部 URL，优先平台上传 `fileId`。 |
| Provider 结果 | URL 不允许指向本机、内网、带凭据或非 http/https 协议。 |
| 删除保护 | 模型配置存在计费规则、策略、模板或生成历史引用时应停用而不是删除。 |
| 画布草稿 | `tldraw` 草稿保存在本地浏览器，不进入后端任务记录。 |

## 配置流程

1. 在主站密钥管理创建图像服务 Secret，字段包含 `apiKey` 或 `api_key`，可选 `baseURL` / `baseUrl` / `base_url`。
2. 在 Console `/models` 选择固定模型，绑定一组或多组 Secret 接入点。
3. 在主站启用可用于文本生成的 LLM，并在 Console `/models` 为需要润色的绘画模型选择“提示词润色模型”。
4. 配置展示名、用户可见性、默认参数、允许参数、模型级计费、优先级、超时和重试。
5. 在 `/policies` 配置参考图、外部 URL、并发、prompt、每日额度等风控。
6. 在 `/templates` 维护用户端可选模板。

## 用户端嵌入边界

- 插件运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内，不重复主导航、账号、全局布局、查询上下文和完整应用外壳。
- 首屏直接展示创作工作区：桌面端左侧创作指令，右侧结果舞台与最近作品；移动端保持单任务流。
- `ResultGallery` 和 `HistoryList` 通过显式 `variant` 支撑首页样式，默认表现继续给详情页和 Console 复用。
- 用户端只展示 public 字段，不展示 `secretId`、Base URL、API Key、上游任务 ID、管理员备注或未脱敏上游响应。
- 预计消耗来自后端估价结果或现有本地 fallback，不硬编码具体价格；失败退款文案只描述策略，不声称真实退款闭环已完成。
- 默认首屏壳、表单、上传入口和错误态不用静态 `lucide-react`；画布、历史、详情和 Console 等 lazy/非默认路径可继续按需使用图标。

## 开发与验证

常用验证命令：

```bash
pnpm --filter echoflow-image check-types
pnpm --filter echoflow-image build:api
pnpm --filter echoflow-image build:web
pnpm --filter echoflow-image build:publish
```

本机 Codex 非交互 PowerShell 需要先显式使用仓库基线 Node 24；若 shell 默认命中旧版本，不要误判为插件问题：

```powershell
nvm use 24
node -v
corepack pnpm -v
```

当前验证状态：

| 项目 | 状态 |
|---|---|
| 单测 | 已覆盖提示词润色主站 LLM 边界、public serializer、请求 ID、计费 SDK、URL 安全、插件依赖清单、媒体插件共享边界、RootLayout 查询上下文、Web 入口 SDK 限流、Console JSON 安全解析、常驻错误态不静态引入 `lucide-react`、外部参考图/遮罩图与 provider 结果 URL DNS 校验、平台上传 fileId 不持久化客户端 URL、批量下载无人工 timer 和退款异常元数据；`node --test extensions\echoflow-image\tests` 是主要静态边界检查入口。 |
| 类型与构建 | 当前 PowerShell 下 `pnpm --filter ...` 被仓库 `.npmrc` 的 `shell-emulator=true` 触发 `sh` 缺失阻塞；已使用同等 Node/CLI 入口完成类型检查、Web 构建、API 构建和 publish 等价链路。 |
| 浏览器视觉 QA | 已用 Browser/IAB 覆盖桌面 1440px、移动 390px、提示词输入、生成/画布切换和返回生成；无乱码、无框架错误覆盖层、无横向滚动。 |
| 真实模型 smoke | 仍需真实 Secret、余额和存储环境覆盖 Responses、Images、compatible Images 的成功、失败、退款和结果转存。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 外部 URL 下载安全 | 参考图和结果 URL 处理复杂，不能用裸 `fetch` 替代。 | 模型请求继续走 SDK provider HTTP client；参考图下载保持 `image-http-client.ts` 集中封装并补 SSRF/重定向测试。 |
| capability 漂移 | Console 配置若覆盖协议能力会误导用户端。 | 能力矩阵继续由 catalog 和协议适配层反推。 |
| 局部重绘未上线 | 用户可能误以为 mask 已可用。 | 保持 reserved，不在用户端暴露未实现能力。 |
| 真实供应商未 smoke | 不能声明外部模型闭环完成。 | 准备 Secret、余额、存储和测试图后逐协议验证。 |
| UI timer 噪音 | 批量下载属于即时 UI 操作，不应使用 `setTimeout` 人为延迟伪装异步流程。 | `image-public-api-boundary.test.mjs` 约束 `ResultGallery` 不再引入人工 timer；真实长流程继续走后端队列。 |
| 首屏包体 | 历史、详情、Console 和画布是非默认路径，不能预加载到默认生成首屏。 | 保持 `routes.tsx` 和 `CreativeCanvasWorkspace` 懒加载；新增画布依赖、tldraw 相关组件或重型管理页时同步补首屏分包测试。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实模型端到端 smoke | Web 生成、provider client、计费、存储 | 准备真实 Secret、余额和存储，逐协议覆盖 `responses` 文生图、`images` 文生图、`openai-compatible-images` 参考图/edits、provider 失败退款和结果转存。 | 记录脱敏生成 ID、模型协议、账务事实和结果文件；Provider 结果 URL 通过公网/DNS 校验后才写回，Web 不暴露 task/raw/Secret。 |
| P1 安全与 public 边界测试 | `tests/*`、URL 下载、capability、serializer | 补私网/本机/凭据 URL、重定向、DNS 解析、平台 fileId、capability 收敛、队列恢复和 public serializer focused tests。 | 非公网或越权输入在 provider 调用前失败；能力矩阵不漂移；Web 不返回 Console 字段。 |
| P1 主站 iframe 视觉复核 | 正式主系统 `/extension/echoflow-image/`、桌面和移动宽度 | 在正式主站插件容器确认端口和页面属本插件后，截图复核桌面和 390px 移动宽度，覆盖生成/画布切换、上传入口、历史入口和错误态。 | 无横向溢出、无重复主系统账号/导航、无 console error；截图或浏览器证据更新到 README。 |
| P2 画布能力边界 | `CreativeCanvasWorkspace`、协议和计费设计 | 将画布能力继续限定为灵感白板；编辑/局部重绘进入完整画布工作流前先补协议和计费边界。 | reserved 能力不进入默认生成路径；新增编辑前有 capability、计费和失败退款测试。 |
| P2 下载 SDK 迁移 | `image-http-client.ts`、主系统安全下载 SDK | 若主系统后续提供安全文件下载 SDK，迁移参考图下载并删除插件内剩余底层下载能力。 | 迁移后 SSRF、跳转、大小、MIME 和超时测试仍通过。 |
