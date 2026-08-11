# 图像工作台

`echoflow-image` 是 EchoFlowAI 的嵌入式图像创作插件。当前已交付的核心是受控文生图：主站模型、队列、计费、风控、结果转存和用户历史形成同一条服务端执行链路；长期目标是在这条链路上逐步建立项目、资产版本、创作板与可审计的派生创作，而不是把浏览器白板或流程 UI 当作任务、账务或资产事实来源。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 是本插件唯一的长期产品路线、业务事实、入口、边界、验证证据、风险与下一 Gate。更新时必须将“当前已实现”“已保留但关闭”“计划能力”分开；临时方案、截图和 QA 记录收口后只保留可复现结论，不创建平行路线文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 主系统内的嵌入式图像创作插件，不是独立完整应用。 |
| 用户端 | 首屏直接展示生成工作区；不重复主系统导航、账号、全局统计、营销页或独立应用壳。 |
| Console | 管理插件可见模型、展示参数、计费、风控、模板和生成记录排障；主站仍管理 Provider、Secret 与模型运行配置。 |
| 当前执行协议 | 运行时统一调用主站 `PublicAiModelService.generateImage()` 文生图；参考图、mask、多参考与协议细分能力保持关闭。 |
| 创作板 | `tldraw` 当前用于本地灵感白板、摆放、批注、拼贴、参考整理和 PNG 导出；它不是生成 DAG、账务内核或服务端项目事实。 |
| 长期方向 | 将已成功的生成结果显式收录为项目资产版本，在服务端记录版本和派生关系；创作板呈现这些资产，生成服务继续独立负责执行与账务。 |
| 计费 | 服务端估价；任务在用户行锁内 reservation，Provider 有效结果存储后在成功终态事务内 exactly-once 扣费；失败不产生扣费，历史已扣费失败任务按持久化退款策略和 billing log 恢复退款；前端不硬编码价格。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生图 | ready | 使用主站已启用的图片模型、公开默认/允许参数和模型级计费创建任务。 |
| 主站模型绑定 | ready | 插件保存主站图片模型 ID、展示覆盖、公开参数与可见性；Provider、Secret、Base URL、超时和重试由主站模型服务负责，不由插件另建接入点。 |
| 参考图生成 | reserved | DTO、文件校验、策略与账务字段留有演进空间，但运行时在请求规范化前拒绝参考图与图生图。 |
| mask / 多参考图 | reserved | Web runtime capability 固定为关闭；不因 Console 配置或 DTO 字段存在而暴露可提交入口。 |
| 模型级计费 | ready | 创建任务前估价和预扣；失败路径按账务事实退款。真实外部 smoke 尚未完成。 |
| 提示词润色 | ready | 用户端只传当前绘画模型 ID；插件查找其绑定的主站 LLM，再用 `PublicAiModelService.generateText()` 润色。 |
| 风控策略 | ready | Console 维护提示词长度、数量、参考图、并发和日额度等策略；入口限流与业务策略分开执行。 |
| 模板预设 | ready | Web 读取 Console 发布模板；首屏只展示轻量卡片，支持本地收藏、替换或追加提示词。 |
| 灵感白板 | ready（本地草稿） | 生成结果可加入 tldraw，进行摆放、批注、拼贴、清空与 PNG 导出；持久化只在当前浏览器，尚无项目、资产或协作服务端事实。 |
| 局部重绘 | reserved | 不提供可提交入口；后续必须先完成受控文件输入、真实 capability、计费、失败恢复与审计。 |
| 任务恢复 | ready | `onModuleInit` 启动恢复与 `@Cron("*/5 * * * *")` stale 扫描双路径，事务锁与 CAS 二次校验避免多实例重复入队。 |
| 真实外部模型 smoke | pending | 仍需在授权的真实 Secret、余额和存储环境中验证成功、失败退款和结果转存。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-image/*`；extension bundle / local dev base 是 `/extension/echoflow-image/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-image/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-image/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-image/` | `src/web/pages/index.tsx` | 生成模式与本地创作板工作台。 |
| Extension bundle/dev | `/extension/echoflow-image/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Extension bundle/dev | `/extension/echoflow-image/history/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Console route | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console route | `/console/models` | `src/web/pages/console/models.tsx` | 固定模型绑定、公开参数、能力收敛和模型级计费。 |
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
| Console model-configs | `@ExtensionConsoleController("model-configs")` | 固定模型配置、默认参数和能力收敛；Provider、Secret 与主站接入点不由插件另建。 |
| Console billing-rules | `@ExtensionConsoleController("billing-rules")` | 模型计费规则。 |
| Console policies | `@ExtensionConsoleController("policies")` | 风控策略。 |
| Console templates | `@ExtensionConsoleController("templates")` | 模板管理。 |

关键服务：

| 服务 | 说明 |
|---|---|
| `GenerationService` | requestKey 幂等、用户行锁 reservation、服务端日/并发配额、Worker association 扣费、主站图片模型调用、状态写回、失败退款恢复和 public 白名单序列化。 |
| `ModelConfigService` | 绑定主站图片模型、用户可见性、默认参数、提示词润色 LLM、public capability 收敛和 Web 参数白名单。 |
| `image-http-client.ts` | 预留给后续受控参考图/安全下载链路的图片 HTTP 边界；当前 Web 不开放参考图生成。 |

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
| 计费与退款 | 服务端估价；创建时以 User 行锁 reservation 防并发突破；Worker 以 generation ID association 和 billing log exactly-once 扣费/退款；失败任务持久化 `refundRequired`，退款失败保留 `refundFailedAt` 并由 recovery 继续；用户端不暴露排障字段。 |
| 提示词润色 | Web 只传当前绘画模型 ID，插件读取该模型绑定的主站 LLM 做润色。 |
| 画布 | `tldraw` 只作为灵感白板、批注、拼贴、参考整理和导出；局部重绘仍是 reserved。 |
| Public 边界 | Web 只返回 public 字段；Console 才展示脱敏 raw 摘要和排障信息。 |

## 数据与安全

| 主题 | 说明 |
|---|---|
| 用户端返回 | Web API 返回生成记录时剥离 `rawRequest`、`rawResponse`、`rawEvents`、`baseURL` 和管理员排障字段。 |
| Console 详情 | 可保留脱敏 raw 摘要，用于排障。 |
| 接入点 | 不保存业务 API Key 明文或密文副本。 |
| Provider Base URL | 插件不复制、保存或向 Web 暴露 Provider Base URL；由主站模型与 Secret 系统处理。 |
| 外部参考图 | 生产默认建议关闭外部 URL，优先平台上传 `fileId`。 |
| Provider 结果 | URL 经公共 DNS/重定向、超时、Content-Length/实际字节、MIME 与 PNG/JPEG/WebP 签名验证后写入插件私有存储，并登记平台 `File`；不保存 Provider URL、签名 URL、token 或原始错误正文。 |
| 受控结果访问 | Web 只返回结果 `fileId`、MIME、大小和可选 revised prompt；读取走已登录的 generation/file ownership 校验端点，静态 uploads 路径不再承载生成结果。Console 读取要求 root 或 `echoflow-image@generation:media-read`。当前私有结果仅支持 active `local` storage；非本地配置在 Provider 调用前 fail-closed，等待平台私有云存储读写/删除能力。 |
| 删除保护 | 模型配置存在计费规则、策略、模板或生成历史引用时应停用而不是删除。 |
| 画布草稿 | `tldraw` 草稿保存在本地浏览器，不进入后端任务记录。 |

## 配置流程

1. 在主站模型与 Secret 管理中配置可用图片模型及其 Provider 凭据；插件不复制、保存或展示 API Key、Base URL 和接入点配置。
2. 在插件 Console `/models` 选择主站图片模型，配置展示名、用户可见性、公开默认参数、允许参数和提示词润色 LLM。
3. 在插件 Console 配置模型级计费与风控策略；当前只启用运行时可闭环的文生图能力。
4. 在 `/templates` 维护用户端可选模板。
5. 所有模型能力改动先以运行层、计费、文件输入、失败退款和 public serializer 的验证为准；Console 标记本身不构成用户端可用性。

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
| 单测与源码边界 | current / 81 passed | `fnm exec --using=v22.20.0 -- corepack pnpm --filter echoflow-image test` | 当前本地 Node 22.20.0 / pnpm 10.20.0；未启动 PostgreSQL/Redis/Provider | 通过；覆盖 requestKey UUID v4 幂等、reservation 规则、成功终态 billing log exactly-once、历史退款 recovery、retry 白名单、零金额结算、public serializer、受控结果 `fileId`/所有权、Web/Console 下载边界、私有路径回收、Provider URL 下载 guard 和文件签名/大小边界。纯规则和源码边界不等价于真实事务或多 Worker 证据。 | 补 PostgreSQL、Redis/BullMQ 多 Worker、真实 FileStorage 与授权下载故障注入测试。 |
| 类型检查与 API 构建 | current / passed | `fnm exec --using=v22.20.0 -- pnpm --filter echoflow-image check-types`；`fnm exec --using=v22.20.0 -- pnpm --filter echoflow-image build:api` | 当前本地 Node 22.20.0 / pnpm 10.20.0 | 通过；API bundle 包含账务规则、generation service 与升级入口。 | 仍需在 disposable PostgreSQL 验证 upgrade 和运行时事务。 |
| Web 构建 | blocked | `node extensions/echoflow-image/scripts/build-web.mjs` | 旧本地 CLI 记录 | 失败于 Vite/Rolldown 解析 workspace tsconfig：`Tsconfig not found @buildingai/typescript-config/base.json`；`require.resolve('@buildingai/typescript-config/base.json')` 可解析到 workspace 包。 | 用当前推荐 `pnpm --filter echoflow-image build:web` 复验并继续排查 Vite/Rolldown workspace tsconfig 解析。 |
| 浏览器视觉 QA | historical | 桌面 1440px、移动 390px、生成/画布切换和返回生成 | 旧浏览器 QA 记录 | 当时无乱码、框架错误覆盖层或横向滚动。 | 当前交付前需确认端口确属本插件，并重新记录桌面/移动浏览器证据。 |
| 真实模型 smoke | pending | `PublicAiModelService.generateImage()` 文生图成功、失败、退款和结果转存 | 需要真实 Secret、余额和存储环境 | 未执行，不能声明真实外部模型闭环完成。 | 准备真实 Secret、余额和存储；二阶段协议细分能力开放后再补逐协议 smoke。 |

## 长期产品与领域分层

长期用户流程按以下顺序演进，不把所有能力塞进同一张画布：

```text
创建或进入项目
→ 生成图片
→ 将成功结果显式收录为项目资产
→ 在创作板中摆放、批注、比较和构图
→ 基于某个资产版本继续创作
→ 查看派生谱系与版本
→ 导出；有真实需求后再协作或使用 Agent 建议
```

| 领域对象 | 未来权威来源 | 当前状态与边界 |
|---|---|---|
| `ImageGeneration` | 插件服务端 | 生成任务、状态、幂等、队列、Provider 调用、计费、退款和结果转存的权威记录；不扩展为项目或资产对象。 |
| `Project` | 插件服务端 | 私有创作空间、所有权和访问范围；当前不存在。 |
| `Asset` | 插件服务端 | 项目内的逻辑素材容器；一次生成可以产生多个资产，不与任务记录混为一谈。 |
| `AssetVersion` | 插件服务端 + 平台 File | 不可变图片版本、稳定 `fileId`、尺寸/MIME 等公开元数据及来源；当前结果尚未通过项目资产收录。 |
| `Derivation` | 插件服务端 | 记录版本之间的参考、裁剪、分割、编辑、放大或生成派生关系；浏览器里的 `parentImageId` 不能充当审计谱系。 |
| `CanvasDocument` / `Revision` | 插件服务端 | 保存创作板中的资产引用、布局、批注和版本；当前 tldraw 仅为本地浏览器草稿。 |
| `Proposal` / `AgentRun` | 插件服务端 | 后期用于只读建议、用户确认和执行审计；当前不存在。 |

不变的端服边界：浏览器提交稳定 ID 和有界参数；服务端重新校验用户/项目权限、文件归属、模型能力、策略、配额、版本冲突和账务。Provider、Secret、原始请求/响应、上游任务 ID、内部存储路径和大图 Base64 不进入 Web public 数据或长期客户端草稿。

## 创作界面分层与画布决策

| 界面 | 长期职责 | 当前与后续边界 |
|---|---|---|
| 生成工作区 | 快速描述需求、选择模型和参数、提交任务、查看状态和结果 | 当前主入口；继续复用现有生成服务和 React Query，不在画布重复创建任务或扣费。 |
| 历史与详情 | 找回任务、查看公开参数/结果/失败状态、重试或回填 | 当前已有；后续增加“收录为资产”和“加入项目”，传稳定来源标识而非图片内部或 Provider 字段。 |
| tldraw 创作板 | 自由摆放、手绘、文字、箭头、批注、拼贴和视觉比较 | 当前本地灵感白板；第一阶段不把它改成执行 DAG，长期可升级为项目 `CanvasDocument` 的编辑表面。 |
| 单图参考编辑器 | 对一张资产版本做构图、批注或导出派生图 | 后续从图片资产打开；`editor.toImage()` 生成的派生文件在正式 File 化前只能是会话态，不能提交图生图。 |
| 资产与版本 | 跨设备保存、命名、收录、比较和恢复正式素材 | 依赖服务端 `Project`、`Asset`、`AssetVersion` 和平台 `fileId`；不先在 localStorage 伪造资产库。 |
| 派生/Recipe 视图 | 解释输入版本、操作、输出版本和可重放关系 | 只有真实操作契约、幂等与审计成立后才增加执行图。 |

### 画布技术选型规则

- **tldraw 保留为创作板**：它已经安装并覆盖手绘、批注、拼贴和自由构图，是当前真实用户任务的直接依赖。
- **XYFlow 不作为本次默认主画布**：仓库已有 `@xyflow/react` 和 `@buildingai/ui` AI Elements，但依赖存在不等于需求成立。只有当产品验证出可执行、可校验、可审计的 Recipe/Execution Graph 需求后，才将其作为独立执行图视图评估；不替换 tldraw，也不让两者合并成一张画布。
- **不自研 DOM/SVG 无限画布**：选择、缩放、连接、触控、键盘、无障碍、性能和持久化都已有成熟依赖可承担，不为假设需求重复建设。
- 上游 `/home/zhijun/.cache/buildingai/infinite-canvas` 固定 commit `ea0414e88cffa6b522cc13c0613b3c8085983a53`、许可证 AGPL-3.0，仅用于理解“项目→节点/连接→受限操作”的功能分层；禁止复制源码、组件结构、类型、命名、素材、视觉或浏览器 Provider 配置方式。

## 功能引入优先级

| 功能 | 优先级 | 引入判断 |
|---|---:|---|
| 文生图、结果批次和变体浏览 | P0 | 已有服务端与 public 数据，先补真实 smoke、恢复和浏览器证据。 |
| 结果/历史加入创作板 | P0 | 可先使用稳定 `generationId`/结果索引；不宣称已形成正式资产。 |
| 项目、资产收录、不可变版本 | P1 | 长期基础设施；先完成 File ownership、软删除和跨设备保存，再扩展编辑能力。 |
| tldraw 项目创作板 | P1 | 将本地灵感板升级为显式保存的 `CanvasDocument`/revision；不引入协作或执行图。 |
| crop、split、局部预览/放大、撤销重做、对象列表 | P1 | 优先复用 tldraw、浏览器原生 Canvas/Blob/ImageBitmap 和仓库已有依赖；输出受控、有限且不付费的派生版本。 |
| `Derivation`、版本比较和操作快照 | P1 | 资产版本稳定后再做；必须服务端记录，不由 `parentImageId` 或 localStorage 代替。 |
| image-to-image、mask、多参考图 | P2 | 只有 SDK/Provider adapter、模型 capability、上传、估价、扣费、退款、幂等和审计全链路通过后开放。 |
| Recipe/Execution Graph | P2（条件性） | 先用真实用户流程证明 tldraw 创作板不足，再评估 XYFlow 或其他执行图依赖；不能提前建设通用 workflow engine。 |
| 项目导入导出、协作 | P3 | 依赖正式文档 schema、revision/ETag、成员权限和冲突处理；不提前引入 CRDT。 |
| Agent 建议与执行 | P3 | 先只读建议和操作预览；生成、删除、批量和导出必须显式确认并复用既有权限/计费 API。 |
| 视频、音频、ComfyUI、ControlNet、LoRA 等扩展域 | 暂不排期 | 没有独立用户证据、结构化输入、质量评测、成本/延迟基线前不扩张领域。 |

## 模块化大版本路线与 Gate

路线按**业务模块的完整闭环**组织，而不再按前端、后端或一次性技术阶段拆分。一个模块只有在其拥有的事实来源、状态机、公开契约、错误处理、测试和真实验证证据都成立时才能标记 `complete`；移动文件、抽象接口或接入 UI 不能单独构成完成。

模块状态只允许使用 `pending`、`in-progress`、`blocked`、`complete`。模块边界是依赖方向，不是新建微服务或提前重构目录的理由：先在现有 `generation`、`billing`、Web 和平台 File 能力中收敛职责，只有出现真实重复时才提取最小共享代码。

```text
生成执行 ──┬── 计费账务 ──┬── 受控媒体 ──┬── 生成工作台 / 本地创作板
            │              │              └── 项目资产与版本 ──┬── 项目创作板与谱系
            └──────────────┴───────────────────────────────────┴── 受控编辑能力
                                                                    ├── 导入导出、协作与 Agent
                                                                    └── 条件性执行图
```

| 模块 | 优先级 / 状态 | 唯一拥有的职责 | 依赖与完成 Gate |
|---|---|---|---|
| 生成执行 | P0 / `in-progress` | `ImageGeneration` 的创建、请求幂等、队列 claim、Provider 调用、终态 CAS、恢复和公开任务状态。 | 依赖模型能力与策略；证明迟到 Worker 不覆盖终态、空结果失败、重试不会重放非失败任务。 |
| 计费账务 | P0 / `in-progress` | 估价、扣费、退款、账务 association 和用户配额 reservation。 | 依赖生成任务 ID；证明并发额度、重复扣费、失败退款和恢复场景的一致性。 |
| 受控媒体 | P0 / `in-progress` | 输入/结果文件的 MIME、大小、所有权、持久化、受控访问和回收。 | 已收敛结果到平台 `File` 与私有 storage root，并由 Web/Console 受控端点读取；仍需 disposable PostgreSQL、真实 FileStorage、授权下载及崩溃/多 Worker recovery 集成证据，才可标记 complete。 |
| 生成工作台 | P0 / `in-progress` | 模型能力呈现、合法参数归一化、当前报价、提交、状态刷新、结果审阅、历史和失败重试交互。 | 只消费 public 契约；验证模型切换、报价乱序、运行中轮询、横竖图、键盘和移动端。 |
| 本地灵感板 | P0 / `in-progress` | tldraw 手绘、批注、拼贴、下载导出和未保存草稿。 | 只保存按用户隔离的浏览器草稿；验证 tldraw 导出契约、可见失败、账号切换隔离和 CORS 反馈。 |
| 项目资产与版本 | P1 / `pending` | `Project`、`Asset`、`AssetVersion` 的所有权、收录、稳定 `fileId`、软删除和跨设备恢复。 | 依赖受控媒体；验证迁移、权限、删除保护、结果收录一致性和 public serializer。 |
| 项目创作板与谱系 | P1 / `pending` | `CanvasDocument`/`Revision` 保存，以及 `Derivation` 的受控来源关系。 | 依赖项目资产与版本；验证文档白名单、版本冲突、恢复和派生文件所有权。 |
| 受控编辑 | P2 / `pending` | crop、split、局部预览/放大，以及 image-to-image、mask、多参考的真实能力闭环。 | 依赖生成、账务、媒体和谱系；任一安全或幂等 Gate 缺失时保持 fail-closed。 |
| 项目协作与 Agent | P3 / `pending` | 项目导入导出、成员权限、revision 冲突，以及经确认的 `Proposal`/`AgentRun`。 | 依赖稳定项目 schema；服务端重验权限、revision、文件和计费。 |
| Recipe / Execution Graph | 条件性 / `pending` | 可复跑端口、批处理、分支、运行状态和审计。 | 仅在真实用户流程证明 tldraw 不足后评估 XYFlow；不建设通用 workflow engine。 |

### 模块 1：生成执行

**当前交付：** 保持 `ImageGeneration` 仅作为任务事实，收敛 `create → claim → deduct → provider → persist → terminal` 状态机；终态写入基于当前数据库状态，恢复和 Worker 不得相互覆盖。

**不属于本模块：** 余额规则属于计费账务；文件读写和 URL 可见性属于受控媒体；项目资产、画布和谱系不写入任务快照。

**完成 Gate：** request key 唯一性、失败任务唯一重试语义、空/无效结果失败、迟到 Worker、队列不可用、stale recovery 和多 Worker 并发测试通过；真实 Provider 成功/失败证据脱敏保存。

### 模块 2：计费账务

**当前交付：** 将报价、扣费、退款和配额视为同一个账务闭环；以 generation ID 关联账务事实，不能由前端金额、本地估算或 Worker 内存状态决定。创建阶段在 User 行锁内完成 requestKey 幂等、并发 reservation 和日额度复核；Worker 在 generation 行锁与同一 EntityManager 中复用平台 billing log，扣费/退款 exactly-once；失败终态持久化 `refundRequired`，退款失败保留时间戳并由 recovery 独立批次继续。

**不属于本模块：** 不保存 Provider 原始响应，不负责图片存储，不为未来项目资产建立第二套余额记录。

**完成 Gate：** 当前请求参数对应当前报价；并发提交不突破用户并发和日额度；重复执行不会重复扣费或退款；零金额任务不伪造 deducted；任意失败、超时或空结果按持久化规则退款并可审计；PostgreSQL、Redis/BullMQ 多 Worker 和真实账务故障恢复证据通过后才可标记 `complete`。

### 模块 3：受控媒体

**当前交付：** 所有输入和结果图片使用平台 File 与授权访问，不将私有生成结果写成长期公开静态链接；远程 Provider 图片经统一 URL/DNS/重定向/MIME/大小/超时 guard 后才可落盘。

**不属于本模块：** 不把浏览器 `data:`、Base64 或 tldraw 本地草稿升级为正式资产；不为未开放参考图建立绕过模型能力的下载路径。

**完成 Gate：** 文件所有者、扩展归属、引用关系和删除回收均可验证；删除后旧访问地址失效；SSRF、重定向、超限、MIME 欺骗和跨用户访问测试通过。

### 模块 4：生成工作台

**当前交付：** 生成表单、模型能力、报价、当前任务、历史、详情和结果展示只调用 public API。模型切换原子归一化 `defaultParams`/`allowedParams`/`maxImages`，报价只显示与当前参数对应的服务端结果。

**不属于本模块：** 不开放 reserved image-to-image/mask/multi-reference；不复制任务、账务或 Provider 事实到 localStorage；不以 `object-cover` 裁切生成结果作为审阅默认值。

**完成 Gate：** 运行任务在当前页和历史页都可靠刷新；重试只在失败任务显示；报价失败、乱序、网络异常、空态、方/横/竖/多图、键盘和 390px 真实浏览器场景通过。

### 模块 5：本地灵感板

**当前交付：** tldraw 只承担手绘、文字、箭头、批注、拼贴、视觉比较和 PNG 下载。浏览器持久化按可信用户主体分区；它始终是未保存草稿，不是项目、资产、账务或审计真相。

**不属于本模块：** 不把 tldraw 变为生成执行 DAG，不引入 XYFlow，不让 `parentImageId` 伪装正式谱系。

**完成 Gate：** 使用 tldraw 5.1.1 的正确导出 API；导出/CORS 失败有用户可见反馈；桌面、移动端、键盘、账号切换和大草稿降级行为通过浏览器验证。

### 模块 6：项目资产、版本、创作板与谱系

**当前交付顺序：** 先完成 `Project`、`Asset`、`AssetVersion` 和显式“收录结果”；再保存 `CanvasDocument`/`Revision` 对资产版本的引用与布局；最后记录 `Derivation` 的收录、裁剪、分割、手绘导出和生成关系。

**不属于本模块：** 不迁移整个 `ImageGeneration` 成资产表，不保存图片 Base64，不提前加入协作、CRDT、Agent 或执行图。

**完成 Gate：** schema 迁移、软删除、访问权限、版本冲突、跨设备恢复、结果文件一致性、文档白名单和浏览器导出验证通过。

### 模块 7：受控编辑、协作与条件性专业流程

**受控编辑：** 在模块 1–3 和谱系完成后，才按真实模型 capability 开放 image-to-image、mask、多参考和局部重绘；客户端只提交稳定 `fileId` 与有界参数。

**协作与 Agent：** 在项目 schema 稳定后先做单项目导入导出；有真实协作证据才增加成员、revision/ETag 和冲突提示；Agent 默认只产生建议，所有生成、删除、批量和导出均须显式确认。

**条件性执行图：** 仅在用户需要可复跑端口、批处理、条件分支、运行状态和审计时评估 XYFlow；执行图独立于 tldraw 创作板，也不成为新的 Provider、账务或任务数据库。

**完成 Gate：** 任一安全、账务、幂等、文件归属、版本或 Provider adapter Gate 未通过，相关 UI、DTO 和 mock 均不能作为开放依据。

### 模块交付顺序

1. 先让**生成执行、计费账务、受控媒体**共同达到可审计的文生图闭环。
2. 并行收敛**生成工作台和本地灵感板**，但它们只能消费已验证契约，不能替服务端补事实。
3. 再建设**项目资产、版本、创作板与谱系**，让本地创作进入可保存、可恢复、可审计的项目空间。
4. 最后按 Gate 开放**受控编辑、协作、Agent 和条件性执行图**。

**当前发布范围：** 在模块 1–5 未完成前，版本只承诺受控文生图、历史详情、失败重试和本地灵感板；不把图生图、mask、多参考、项目资产、协作、Agent 或执行图写入发布能力。

## 开发整理规则

1. 先读本 README、当前源码、package scripts 和验证证据，再选择一个完整阶段，不跨 Gate 做后续功能。
2. 行为变更遵循 ECC：`/ecc:plan` → `/ecc:tdd-workflow` → `/ecc:code-review` → `/ecc:verification-loop`；真实 build/type failure 才使用 `/ecc:build-fix`，事实文档变化使用 `/ecc:update-docs`。
3. UI 页面级改版使用 `.claude/design-workflow.md` 与 `echoflow-ui-workflow`：先 Contract Brief，再 dev-only Gallery 方案；只迁移选中方案并删除落选代码。
4. 依赖选择遵循 Ponytail：先确认是否必须构建，优先复用仓库组件、标准库、原生能力和已安装依赖；只有存在具体缺口时才增加最小代码或依赖。
5. 生成、上传、文件、Provider、Secret、队列、计费和 public serializer 变更必须做 `security-boundary-reviewer`；Web UI、capability、懒加载和 Design Gallery 变更必须做 `extension-ui-contract-reviewer`。
6. 不覆盖未提交改动，不自动执行 `pnpm install`、Docker、数据库写入、真实付费生成、发布或全仓 build；需要时先说明环境、外部影响和停止条件。
7. 每次阶段交付后只在本 README 更新当前状态、已验证证据、未执行证据、风险和下一 Gate；不把编译通过、mock 成功或历史命令记录写成真实完成。

## 验证矩阵与交接

| 验证类别 | 当前规则 |
|---|---|
| 静态/单元 | 使用插件 package script 与边界测试；测试 public 白名单、reserved capability、幂等、错误恢复和本地状态序列化。 |
| 类型/API/Web 构建 | `pnpm --filter echoflow-image check-types`、`build:api`、`build:web`；发布前再运行 `build:publish`。 |
| 数据库/队列 | 项目、资产、版本、谱系或任务恢复变更需 disposable PostgreSQL、Redis/Worker、多实例和迁移/升级证据。 |
| 浏览器 | 确认 URL、标题、Vite base 和端口属于本插件；覆盖桌面、真实约 390px、键盘、错误/空/处理中/多比例结果和无障碍状态。 |
| 真实外部 smoke | 需要授权的 Secret、余额、Worker、存储和模型；未执行时必须标记 `pending`，不得用 mock 替代。 |
| 交接 | 记录阶段、文件范围、ECC 与项目 reviewer、命令、结果、跳过项、外部条件和下一件未完成任务。 |

## 已知风险与当前下一 Gate

| 风险 | 影响 | 处理原则 |
|---|---|---|
| 外部 URL / 参考图下载 | 可能造成 SSRF、重定向绕过、超限或 MIME 欺骗。 | 统一使用平台公共 URL/DNS/下载 guard；优先 `fileId`，禁止裸 `fetch`。 |
| 文件所有权与删除 | 可能造成跨用户读取、删除或把文件接入错误任务。 | 服务端验证 uploader、extension、项目权限和引用关系；资产删除先软删除/停用。 |
| capability 漂移 | Console 标记可能超过真实运行链路。 | `ModelConfigService` 和 generation runtime 双重 fail-closed；adapter 证据先于 UI 开放。 |
| 重试与计费 | Provider 已启动后自动重放可能重复扣费或生成。 | request-level 幂等、终态 CAS、账务 association 和恢复测试先于编辑能力。 |
| 首屏包体 | tldraw、历史、详情和未来执行图影响默认生成体验。 | 继续保持路由与 `CreativeCanvasWorkspace` lazy；执行图若实现也必须独立分包。 |
| 领域膨胀 | 过早支持视频、音频、协作、Agent 或通用 workflow engine，导致事实源混乱。 | 每次只进入一个有用户证据和质量/成本基线的领域。 |

**当前下一 Gate：** 版本固定为 `0.0.1`，不得擅自升级；因此已完成 `0.0.1` 的安装实例无法自动获得本轮新增字段与 requestKey 索引谓词，必须先由发布负责人批准兼容迁移版本/策略。批准后，在 disposable PostgreSQL 中验证已安装实例升级、User 行锁 reservation、daily quota、软删除 requestKey 索引、成功终态账务事务，以及平台 File 记录/私有结果读取/删除失败重试；再在 Redis/BullMQ 多 Worker 中验证 claim/recovery/迟到 Worker 和 staged file journal 回收；最后用授权真实 Secret、余额、私有存储和 Provider 完成成功、Provider 失败、空结果、Provider redirect/超限/MIME 欺骗、存储失败与历史退款恢复 smoke。上述证据未完成前，计费账务和受控媒体保持 `in-progress`，不开放参考图、mask、多参考或执行图。

**本 README 的路线记录更新日期：** 2026-08-09。
