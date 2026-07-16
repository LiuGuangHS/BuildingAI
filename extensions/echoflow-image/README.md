# 图像工作台

`echoflow-image` 是 EchoFlowAI 的图像工作台插件。用户端专注于生成、编辑和优化图片，适合封面、海报与营销素材；Console 端负责固定模型配置、接入点、模型级计费、风控策略、模板和全量历史排障。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 边界 |
|---|---|
| 产品形态 | 主系统内的嵌入式绘画插件，不是独立完整应用。 |
| 用户端 | 首屏直接展示创作工作区，不做营销页、独立 App Header、账号信息、全局统计或侧边栏。 |
| Console | 管理员配置模型、计费、风控、模板和历史排障。 |
| 模型来源 | 使用主系统已启用的 text-to-image 模型，插件 Console 维护展示名、默认参数、允许参数、计费和 Web 可见能力。 |
| 协议 | 当前运行链路统一走主站 `PublicAiModelService.generateImage()` 文生图；参考图、mask 和多协议细分能力保留为二阶段补全。 |
| 画布 | `tldraw` 用作灵感白板、批注、拼贴、参考整理和导出，不承担节点式生成内核。 |
| 计费 | 生成前预估和预扣，失败按账务事实退款；前端不硬编码价格。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生图 | ready | 按模型协议、默认参数、允许参数和模型级计费生成。 |
| 参考图生成 | reserved | DTO、文件校验和策略字段已保留；当前运行链路仍走主站 `PublicAiModelService.generateImage()`，暂不向 Web 暴露图生图能力。 |
| 多协议 capability | reserved | 当前 Web 只按实际运行链路公开文生图；Responses / Images / OpenAI-compatible Images 的图生图、mask、多参考图能力进入后续补全阶段。 |
| 模型接入点 | ready | 每个固定模型可绑定多组主站 Secret，支持优先级、超时、重试和 Base URL 覆盖。 |
| 模型级计费 | ready | 生成前预估和预扣，失败按模型规则退款。 |
| 提示词润色 | ready | 用户端传当前绘画模型 ID；插件读取该绘画模型绑定的主站 LLM，再通过 `PublicAiModelService.generateText()` 润色。 |
| 风控策略 | ready | prompt 长度、张数、参考图、并发、每日额度等策略由 Console 维护。 |
| 模板预设 | ready | Web 可读取模板，Console 可管理模板；用户端首屏只展示轻量模板卡片，支持展开更多、本地收藏、替换或追加到提示词。 |
| 无限画布 | ready | 白板草稿保存在本地浏览器，生成结果可整理到画布。 |
| 局部重绘 | reserved | 旧轻量遮罩画布已下线，后续并入完整画布工作流。 |
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复 + `@Cron("*/5 * * * *")` 定时 stale 扫描双路径，事务内悲观锁+CAS二次校验防止多实例重复入队。 |
| 真实外部模型 smoke | pending | 需要真实 Secret 覆盖生成、失败退款和结果转存。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-image/*`；extension bundle / local dev base 是 `/extension/echoflow-image/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-image/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-image/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-image/` | `src/web/pages/index.tsx` | 生成模式与无限画布工作台。 |
| Extension bundle/dev | `/extension/echoflow-image/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Extension bundle/dev | `/extension/echoflow-image/history/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Console route | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console route | `/console/models` | `src/web/pages/console/models.tsx` | 固定模型、接入点、默认参数和模型级计费。 |
| Console route | `/console/policies` | `src/web/pages/console/policies.tsx` | 风控限流。 |
| Console route | `/console/templates` | `src/web/pages/console/templates.tsx` | 模板预设。 |
| Console route | `/console/history` | `src/web/pages/console/history.tsx` | 全量生成历史。 |
| Console route | `/console/history/:id` | `src/web/pages/console/detail.tsx` | 管理端任务详情与脱敏 raw 摘要。 |

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

关键服务：

| 服务 | 说明 |
|---|---|
| `GenerationService` | 请求幂等、余额预检、预扣、主站图片模型调用、状态写回、失败退款和 public 白名单序列化。 |
| `ModelConfigService` | 绑定主站图片模型、用户可见性、默认参数、提示词润色 LLM、public capability 收敛和 Web 参数白名单。 |
| `image-http-client.ts` | 预留给二阶段参考图/安全下载链路的图片 HTTP 边界；当前 Web 不开放参考图生成。 |

## 用户端边界

| 主题 | 说明 |
|---|---|
| 页面形态 | 插件运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内，不重复主导航、账号、全局布局、查询上下文和完整应用外壳。 |
| 生成工作区 | 首屏直接展示创作工作区：桌面端左侧创作指令，右侧结果舞台与最近作品；移动端保持单任务流。 |
| 首屏分包 | 默认生成首屏不直接挂载创作流和 `tldraw` 灵感白板；切换到画布模式后再懒加载 `CreativeCanvasWorkspace`。 |
| 表单体验 | 提示词区作为视觉重心；模型区展示 public 能力标签；尺寸比例和生成数量提供快捷控件，算力预估与失败退款说明固定在提交区。 |
| 结果复用 | 空状态提供可回填的提示词建议；生成结果可复制提示词、下载、打开和整理到画布；作为参考图继续生成仅在后续 capability 开放后出现。 |
| 组件复用 | `ResultGallery` 和 `HistoryList` 通过显式 `variant` 支撑首页样式，默认表现继续给详情页和 Console 复用。 |
| 公开边界 | 用户端只展示 public 字段，不展示 `secretId`、Base URL、API Key、上游任务 ID、管理员备注或未脱敏上游响应。 |
| 降级与价格 | 预计消耗来自后端估价结果或现有本地 fallback，不硬编码具体价格；失败退款文案只描述策略，不声称真实退款闭环已完成。 |
| 图标与预览 | 默认首屏壳、表单、上传入口和错误态不用静态 `lucide-react`；画布、历史、详情和 Console 等 lazy/非默认路径可继续按需使用图标。 |

## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| 主站模型绑定 | `ModelConfigService` 从主系统可用 text-to-image 模型生成插件配置视图，Web 只暴露经过白名单收敛的 public capability/default/allowed 参数。 |
| 图像协议 | 当前执行层统一调用 `PublicAiModelService.generateImage()` 文生图；图生图、mask、多参考图和 provider-specific 参数进入二阶段 SDK/适配层补全。 |
| 接入点与 Secret | 插件不保存业务 API Key；运行时复用主系统 Secret、provider helper 和主站图片模型能力。 |
| 参考图与结果 URL | 当前 Web 不开放参考图/mask；保留 DTO/策略字段并在任何 DNS/上传查询前拒绝 reserved 请求，provider 结果 URL 写回前走公网/DNS 校验。 |
| 计费与退款 | 生成前估价预扣，失败按账务事实退款；退款异常进入脱敏 metadata，用户端不暴露排障字段。 |
| 提示词润色 | Web 只传当前绘画模型 ID，插件读取该模型绑定的主站 LLM 做润色。 |
| 画布 | `tldraw` 只作为灵感白板、批注、拼贴、参考整理和导出；局部重绘仍是 reserved。 |
| Public 边界 | Web 只返回 public 字段；Console 才展示脱敏 raw 摘要和排障信息。 |

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

## 开发与验证

常用验证命令：

```bash
pnpm --filter echoflow-image check-types
pnpm --filter echoflow-image build:api
pnpm --filter echoflow-image build:web
pnpm --filter echoflow-image build:publish
```

本机 Codex 非交互 PowerShell 需要先显式使用仓库基线 Node 22.20；若 shell 默认命中其他版本，不要误判为插件问题：

```powershell
nvm use 22.20.0
node -v
corepack pnpm -v
```

验证证据：

| 范围 | 证据状态 | 命令/场景 | 环境基线 | 结论 | 后续条件 |
|---|---|---|---|---|---|
| 单测 | historical | `node --test extensions/echoflow-image/tests/image-public-api-boundary.test.mjs` | 旧本地 CLI 记录 | 通过，覆盖 public 白名单 serializer、public model-options 白名单、reserved 参考图/遮罩图早拦截、首屏分包、RootLayout 查询上下文、限流、Console JSON、provider 结果 URL 校验、平台 fileId 和退款异常 metadata 等边界。 | 发布或交付前用当前 Node 22.20 / pnpm 10.20.0 环境重新执行推荐 package script 或 targeted test。 |
| 类型检查与 API 构建 | historical | 直接 `node_modules/.bin/vue-tsc --noEmit -p extensions/echoflow-image/tsconfig.json`；直接 `../../node_modules/.bin/tsup --config tsup.config.ts` | 旧本地 CLI 记录，且使用了直接 CLI 排障方式 | 历史排障记录显示通过；这些直接 CLI 调用不是当前推荐验证方式。 | 当前推荐使用 `pnpm --filter echoflow-image check-types` 和 `pnpm --filter echoflow-image build:api`；若脚本不能覆盖，应修脚本或依赖声明。 |
| Web 构建 | blocked | `node extensions/echoflow-image/scripts/build-web.mjs` | 旧本地 CLI 记录 | 失败于 Vite/Rolldown 解析 workspace tsconfig：`Tsconfig not found @buildingai/typescript-config/base.json`；`require.resolve('@buildingai/typescript-config/base.json')` 可解析到 workspace 包。 | 用当前推荐 `pnpm --filter echoflow-image build:web` 复验并继续排查 Vite/Rolldown workspace tsconfig 解析。 |
| 浏览器视觉 QA | historical | 桌面 1440px、移动 390px、生成/画布切换和返回生成 | 旧浏览器 QA 记录 | 当时无乱码、框架错误覆盖层或横向滚动。 | 当前交付前需确认端口确属本插件，并重新记录桌面/移动浏览器证据。 |
| 真实模型 smoke | pending | `PublicAiModelService.generateImage()` 文生图成功、失败、退款和结果转存 | 需要真实 Secret、余额和存储环境 | 未执行，不能声明真实外部模型闭环完成。 | 准备真实 Secret、余额和存储；二阶段协议细分能力开放后再补逐协议 smoke。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 外部 URL 下载安全 | 参考图和结果 URL 处理复杂，不能用裸 `fetch` 替代。 | 模型请求继续走 SDK provider HTTP client；参考图下载保持 `image-http-client.ts` 集中封装并补 SSRF/重定向测试。 |
| capability 漂移 | Console 配置若覆盖运行层未闭环能力会误导用户端。 | Web public capability 继续由 `ModelConfigService` 白名单收敛；图生图、mask、多参考和反向提示词在 SDK/适配层真实支持前保持 reserved。 |
| 局部重绘未上线 | 用户可能误以为 mask 已可用。 | 保持 reserved，不在用户端暴露未实现能力。 |
| 真实供应商未 smoke | 不能声明外部模型闭环完成。 | 准备 Secret、余额、存储和测试图后逐协议验证。 |
| UI timer 噪音 | 批量下载属于即时 UI 操作，不应使用 `setTimeout` 人为延迟伪装异步流程。 | `image-public-api-boundary.test.mjs` 约束 `ResultGallery` 不再引入人工 timer；真实长流程继续走后端队列。 |
| 首屏包体 | 历史、详情、Console 和画布是非默认路径，不能预加载到默认生成首屏。 | 保持 `routes.tsx` 和 `CreativeCanvasWorkspace` 懒加载；新增画布依赖、tldraw 相关组件或重型管理页时同步补首屏分包测试。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实模型端到端 smoke | Web 生成、主站图片模型、计费、存储 | 准备真实 Secret、余额和存储，覆盖当前 `PublicAiModelService.generateImage()` 文生图成功、provider 失败退款和结果转存。 | 记录脱敏生成 ID、主站模型、账务事实和结果文件；Provider 结果 URL 通过公网/DNS 校验后才写回，Web 不暴露 task/raw/Secret。 |
| P1 安全与 public 边界测试 | `tests/*`、URL 下载、capability、serializer | 补私网/本机/凭据 URL、重定向、DNS 解析、平台 fileId、capability 收敛、队列恢复和 public serializer focused tests。 | 非公网或越权输入在 provider 调用前失败；能力矩阵不漂移；Web 不返回 Console 字段。 |
| P1 主站 iframe 视觉复核 | 正式主系统 `/extension/echoflow-image/`、桌面和移动宽度 | 在正式主站插件容器确认端口和页面属本插件后，截图复核桌面和 390px 移动宽度，覆盖生成/画布切换、上传入口、历史入口和错误态。 | 无横向溢出、无重复主系统账号/导航、无 console error；截图或浏览器证据更新到 README。 |
| P2 画布能力边界 | `CreativeCanvasWorkspace`、协议和计费设计 | 将画布能力继续限定为灵感白板；编辑/局部重绘进入完整画布工作流前先补协议和计费边界。 | reserved 能力不进入默认生成路径；新增编辑前有 capability、计费和失败退款测试。 |
| P2 下载 SDK 迁移 | `image-http-client.ts`、主系统安全下载 SDK | 若主系统后续提供安全文件下载 SDK，迁移参考图下载并删除插件内剩余底层下载能力。 | 迁移后 SSRF、跳转、大小、MIME 和超时测试仍通过。 |
