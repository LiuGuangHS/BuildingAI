# EchoFlowAI Image

`echoflow-image` 是 EchoFlowAI 的图像生成与创作整理插件。用户端专注于提示词生成、参考图创作、结果预览、历史复用和画布整理；Console 端负责固定模型配置、接入点、模型级计费、风控策略、模板和全量历史排障。

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

## 用户端设计优化计划

本轮优化以 `Flow Canvas Command Bar` 为主方向，吸收 `Luminous Creator Strip` 的参数清晰度。目标是把用户端首页从偏完整应用的后台工作台，收敛成主系统里的现代嵌入式绘画插件。

参考图：

- Flow Canvas Command Bar: `C:/Users/zhiju/.codex/generated_images/019edf25-00b2-7a71-9ab6-4b5e03afaee6/ig_09d1d40737f3d08d016a353b2b22d8819aaf41d466268c7f22.png`
- Luminous Creator Strip: `C:/Users/zhiju/.codex/generated_images/019edf25-00b2-7a71-9ab6-4b5e03afaee6/ig_09d1d40737f3d08d016a353a935c80819a8f32af55235a8a0e.png`

### 设计原则

- 插件运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内，不重复主导航、账号、全局布局、查询上下文和完整应用外壳。
- 首屏直接展示创作工作区，不做营销 Hero 或“进入工作台”中间页。
- 桌面端左侧为紧凑创作指令面板，右侧为结果舞台，最近作品作为次级胶片条。
- 移动端保持单任务流：创作指令、结果、最近作品依次展示。
- AI 感放在命令式输入、模型能力提示、生成状态、结果整理和失败退款说明里，不堆泛化“AI 风”文案。
- 动画保持轻量：按钮 loading、hover 工具条、图片轻微缩放和高级设置展开；优先使用组件与 utility class。
- 不新增主系统改动，不改 Console 信息架构，不改后端生成、计费、Secret、上传和 URL 安全逻辑。

### 开发任务拆解

| 顺序 | 文件 | 任务 | 验收 |
|---|---|---|---|
| 1 | `src/web/components/workspace/workspace-shell.tsx` | 移除 `min-h-screen`、过宽居中容器、大标题说明和无关 badge，改成嵌入式插件工具栏。 | 首页不再像独立 App 外壳；只保留 EchoFlowAI 绘画、模式切换、刷新和历史入口。 |
| 2 | `src/web/components/workspace/mode-switch.tsx` | 把生成/画布切换改成紧凑 segmented control。 | 窄宽度下不溢出，说明文字不挤占工具栏。 |
| 3 | `src/web/components/panels/quick-generate-panel.tsx` | 重做首页布局：左侧创作指令，右侧结果舞台与最近作品纵向栈。 | 桌面端舞台和最近作品同屏；移动端顺序清晰。 |
| 4 | `src/web/components/generation-form.tsx` | 保留 payload 和 estimate 逻辑，把表单视觉改成 command composer。 | 提示词、模板、润色、参考图、模型、参数、预计消耗和退款说明都可见且不拥挤。 |
| 5 | `src/web/components/result-gallery.tsx` | 增加 `variant="stage"`，首页用舞台化结果区，默认 `card` 保持给详情页和 Console。 | 首页结果更现代；详情页和 Console 不被误改。 |
| 6 | `src/web/components/history-list.tsx` | 增加 `variant="filmstrip"`，首页最近作品用胶片条，默认列表保持不变。 | 最近作品服务复用/重试/查看，不抢主结果舞台。 |
| 7 | `src/web/pages/index.tsx` | 接入 `stage` 和 `filmstrip` 变体，更新首页标题与文案。 | 查询、生成、重试、删除、复用、轮询和 toast 行为不变。 |
| 8 | `src/web/styles/index.css` | 收敛插件 CSS，只保留组件/utility 难以表达的舞台网格等少量特例。 | 普通面板、按钮、Tabs、表单、胶片条和响应式布局优先由 `@buildingai/ui` 组件与 Tailwind utility 完成。 |

### 关键实现约束

- `ResultGallery` 和 `HistoryList` 被 Web 详情页、Web 历史页、Console 历史页和 Console 详情页复用，必须通过显式 `variant` 控制首页新样式，默认表现不得改变。
- `GenerationForm` 的 `buildGenerationPayload()`、估价 `useEffect`、参考图 payload 构造、模型 capability 判断和提交逻辑保持不变。
- 用户端文案只能展示 public 字段，不展示 `secretId`、Base URL、API Key、上游任务 ID、管理员备注或未脱敏上游响应。
- 预计消耗来自后端估价结果或现有本地 fallback，不硬编码具体价格。
- 失败退款文案只能描述策略，例如“失败按账务结果退款”，不能声称真实退款闭环已完成。
- 常驻路径避免引入动态图标加载；loading、空态、错误页和 RootLayout 相关基础 UI 使用 CSS、文本符号或系统组件承接，不静态引入 `lucide-react`。
- CSS 不写 `hsl(var(--primary))` 二次包装，直接使用主系统 CSS 变量或组件 token；普通视觉样式优先写在组件 `className` 中，不长期维护大段插件 CSS。

### 视觉验收标准

- 第一眼是插件工作区，不是完整应用首页。
- 没有重复主系统用户、导航、头像、全局统计或营销介绍。
- 工具栏高度紧凑，EchoFlowAI 绘画是明确业务标识。
- 创作面板像命令面板，不像老式后台表单。
- 结果区域是视觉中心，有清楚的空、加载、失败、成功状态。
- 最近作品是辅助层级，可快速复用、重试和查看。
- 桌面、窄 iframe、移动端都不出现文字重叠、按钮撑破或横向滚动。
- 动画轻，不复杂，不使用大面积光球、bokeh、过度渐变或连续背景运动。

## 开发与验证

常用验证命令：

```bash
pnpm --filter echoflow-image check-types
pnpm --filter echoflow-image build:api
pnpm --filter echoflow-image build:web
pnpm --filter echoflow-image build:publish
```

本机 Codex 非交互 PowerShell 需要先显式使用 Node 22：

```powershell
$node22 = "$env:APPDATA\fnm\node-versions\v22.23.0\installation"
$env:PATH = "$node22;$env:PATH"
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

## 用户端视觉重构完成记录

本轮已按第二张 `Flow Canvas Command Bar` 方向回炉重构用户端首页，并吸收第一张的信息密度。改动只落在 `extensions/echoflow-image` 插件内。

| 项目 | 完成情况 |
|---|---|
| 嵌入式外壳 | `WorkspaceShell` 已改为一行插件命令条，保留品牌、生成/画布、主站模型、OpenAI-compatible、刷新和历史入口。 |
| 模式切换 | `WorkspaceModeSwitch` 已改为带短说明的生成/画布 segmented control。 |
| 首页布局 | `QuickGeneratePanel` 已改为桌面左侧创作命令、右侧结果舞台和最近作品胶片栈；移动端保持创作、结果、历史单列顺序。 |
| 创作面板 | `GenerationForm` 已整理为 command composer，保留生成 payload、估价、参考图、模型能力和提交逻辑。 |
| 结果舞台 | `ResultGallery` 新增 `stage` 变体，首页使用舞台化空、加载、失败和成功状态；默认 `card` 保持给详情页和 Console。 |
| 最近作品 | `HistoryList` 新增 `filmstrip` 变体，首页用于复用、重试和查看；默认列表保持给历史页和 Console。 |
| 样式策略 | 已从大段 `ef-image-*` CSS 收敛为组件和 Tailwind utility 为主；`index.css` 只保留舞台网格背景等少量 scoped 特例。 |
| 文案 | 首页说明书式老文案已重写为短句产品语言，并保留预计消耗、失败退款、模型来源和历史复用信息。 |
| 路由分包 | Web 历史、详情、Console 管理页和 `CreativeCanvasWorkspace` 均已改为 React lazy；默认生成首屏不再同步拉入非当前路由、画布工作区和 tldraw 相关能力。 |

验证记录：

| 命令 | 结果 |
|---|---|
| `rg` 检查用户端源码中的 `ef-image-*` 与乱码特征 | 本轮组件/utility 收敛后只剩 `ef-image-stage-grid` 舞台网格特例，未发现乱码残留。 |
| `rg -n min-h-screen|100vh|max-w-\[1680px\]|orb|bokeh|hero|hsl\(var extensions\echoflow-image\src\web` | 未发现新增整页外壳、营销 Hero、禁用装饰模式或主题变量二次包装。 |
| `git diff --check -- extensions\echoflow-image AGENTS.md` | 通过；仅有 Windows 换行提示。 |
| `pnpm --filter echoflow-image check-types` / `build:web` | 当前 PowerShell 环境下被 `sh is not recognized` 阻塞，根因是 `.npmrc` 启用 `shell-emulator=true`。 |
| `node node_modules\.pnpm\vue-tsc@2.2.12_typescript@5.9.3\node_modules\vue-tsc\bin\vue-tsc.js --noEmit -p extensions\echoflow-image\tsconfig.json` | 通过。 |
| `node scripts\build-web.mjs` | 通过；保留 Vite chunk size 和 `@rolldown/plugin-babel` 耗时 warning。 |
| `..\..\node_modules\.bin\tsup.CMD` | API 构建通过。 |
| `..\..\node_modules\.bin\vite.cmd build` | Web 构建通过；主入口 JS 约 2.39 MB，保留 Vite chunk size warning。 |
| `build:publish` 等价链路 | 停止本地 4177 dev server 后，安全清理 `build/.nuxt/.output/.temp`，再执行 `node scripts\build-web.mjs` 与 `tsup.CMD` 通过。 |
| `node --experimental-strip-types --test tests/*.test.mjs` | 29/29 通过；仍有 Node 对未声明 ESM package 的既有 warning。 |
| Browser/IAB 桌面宽度 1440px | 首页显示插件工具栏、创作指令、结果舞台和最近作品；提示词输入后草稿保留，生成/画布切换和返回生成可用，无横向滚动。 |
| Browser/IAB 移动宽度 390px | 首页显示生成/画布、创作指令、结果舞台和最近作品；灵感模板改为组件网格后不再撑出视口。 |
| Browser/IAB 截图 | Browser CDP `Page.captureScreenshot` 在当前会话超时；本轮使用 DOM snapshot、visible DOM、控制台日志和响应式宽度指标完成视觉 QA。 |

浏览器 QA 备注：本地 Vite 插件页面未连通真实 Web API 时，输入提示词或加载历史会出现 `Network Error` toast；这不影响当前生成首页、画布切换和布局验收。画布进入时仍有 tldraw 授权提示文案，属于第三方组件状态。

待正式联调：

- 真实外部模型生成、失败退款和结果转存仍需正式 Secret、余额和存储环境。
- 浏览器 QA 已通过独立 Vite 预览覆盖移动与桌面宽度；正式主站 iframe 环境仍建议发布前再截图复核一次。

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 外部 URL 下载安全 | 参考图和结果 URL 处理复杂，不能用裸 `fetch` 替代。 | 模型请求继续走 SDK provider HTTP client；参考图下载保持 `image-http-client.ts` 集中封装并补 SSRF/重定向测试。 |
| capability 漂移 | Console 配置若覆盖协议能力会误导用户端。 | 能力矩阵继续由 catalog 和协议适配层反推。 |
| 局部重绘未上线 | 用户可能误以为 mask 已可用。 | 保持 reserved，不在用户端暴露未实现能力。 |
| 真实供应商未 smoke | 不能声明外部模型闭环完成。 | 准备 Secret、余额、存储和测试图后逐协议验证。 |
| Web 主入口过大 | 图像工作台、画布与历史等能力仍集中进主入口，首屏 JS 约 2.39 MB。 | 后续优先拆分画布、历史和 Console 重组件，确保不把 tldraw 或画布能力预加载到默认生成首屏。 |
| UI timer 噪音 | 批量下载属于即时 UI 操作，不应使用 `setTimeout` 人为延迟伪装异步流程。 | `image-public-api-boundary.test.mjs` 约束 `ResultGallery` 不再引入人工 timer；真实长流程继续走后端队列。 |
| 首屏包体 | 历史、详情、Console 和画布是非默认路径，不能预加载到默认生成首屏。 | 保持 `routes.tsx` 和 `CreativeCanvasWorkspace` 懒加载；新增画布依赖、tldraw 相关组件或重型管理页时同步补首屏分包测试。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实模型端到端 smoke | Web 生成、provider client、计费、存储 | 准备真实 Secret、余额和存储，覆盖文生图、参考图生成、失败退款和结果转存。 | 记录脱敏生成 ID、模型协议、账务事实和结果文件；Provider 结果 URL 通过公网/DNS 校验后才写回。 |
| P1 安全与 public 边界测试 | `tests/*`、URL 下载、capability、serializer | 继续补 URL 安全、capability 收敛、队列恢复和 public serializer focused tests。 | 测试覆盖私网/凭据 URL 拒绝、能力矩阵不漂移、Web 不返回 Console 字段。 |
| P1 主站 iframe 视觉复核 | 正式主系统 `/extension/echoflow-image/`、桌面和移动宽度 | 在正式主站插件容器截图复核桌面和 390px 移动宽度，覆盖生成/画布切换和历史入口。 | 无横向溢出、无重复主系统账号/导航、无 console error；截图或浏览器证据更新到 README。 |
| P2 画布能力边界 | `CreativeCanvasWorkspace`、协议和计费设计 | 将画布能力继续限定为灵感白板；编辑/局部重绘进入完整画布工作流前先补协议和计费边界。 | reserved 能力不进入默认生成路径；新增编辑前有 capability、计费和失败退款测试。 |
| P2 下载 SDK 迁移 | `image-http-client.ts`、主系统安全下载 SDK | 若主系统后续提供安全文件下载 SDK，迁移参考图下载并删除插件内剩余底层下载能力。 | 迁移后 SSRF、跳转、大小、MIME 和超时测试仍通过。 |
