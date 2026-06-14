# AI视频工作台

面向创作者的 BuildingAI AI 视频生成插件。当前以 HappyHorse 为首个可用供应商，支持文生视频、图生视频、视频编辑、任务历史和算力计费，后续按统一 Provider Adapter 扩展 Kling、Seedance/ARK、RunningHub/ComfyUI 等视频能力。

插件定位是“用户视频创作台 + 管理员视频运营台”：用户端只做生成、历史和结果查看；管理员端负责供应商、模型、计费、模板、风控和任务运维。

## 当前状态

- 版本：`0.0.12`
- 当前主供应商：HappyHorse
- 当前边界：核心通用视频工作台，暂不包含脚本、分镜、TTS、BGM、字幕和多片段合成
- 已有能力：插件实体、Web/Console 双入口、双 Controller、双 HTTP client、前端上传、插件扣费、任务历史、模型配置、计费规则、模板预设、提示词优化、优化模型选择、按对话 token 计费、素材元数据、基础风控、批量运维、任务备注、状态时间线、失败分类、配置审计列表、健康统计、HappyHorse Adapter、Provider Registry、短视频制作预留入口、HappyHorse 运行配置和 Webhook Secret
- 下一目标：使用真实 HappyHorse Key 完成四类模型的端到端联调，并验证提示词优化到生成的完整体验
- 2026-06-14 审查结论：用户端/管理端边界已按 Web API、Console API、Web service、Console service 分离；通用工作台功能主干已完成，剩余工作集中在真实联调、生产化队列/缓存/E2E、平台 Secret 绑定、多供应商真实接入和短视频独立页面

## 版本记录

### 0.0.12

- 修复管理端禁用/隐藏模型后，用户端仍可能通过默认模型兜底提交的问题
- 视频生成扣费与任务 `billingStatus` 更新改为事务绑定，失败退款也同步保存账务和业务状态
- Webhook 未配置 Secret 时不再信任公开回调，避免外部请求直接改写任务终态
- 用户端限流从整个 Controller 收窄到生成提交和提示词优化，避免模型/模板/轮询请求误伤
- 主站上传素材的插件文件 URL 允许带 `fileId` 的本地/内网上传路径通过校验，外部 URL 仍保留 SSRF 防护
- 风控策略开始校验上传素材 size，执行管理端配置的图片/视频大小限制
- 提示词优化新增插件内幂等记录表 `video_prompt_optimization`，同一 `requestKey` 不重复扣费
- 配置审计记录管理员 `operatorId`
- `pnpm test` 改为类型检查 + Jest 单测，并替换已漂移的旧单测；测试文件迁移到 `tests/api`，避免混入发布源码
- 新增 `0.0.12` Upgrade，创建提示词优化幂等记录表

### 0.0.11

- 用户上传素材保存并展示 `fileId`、URL、mimeType、size、fileName，用户详情和管理详情均可查看
- Console 配置页新增配置审计列表，复用已有脱敏审计表
- 管理首页健康检查新增模型配置完整度、24h 失败分类和 Provider 5xx 统计
- Console 详情新增单任务取消、失败任务重试；历史页新增当前页批量取消和批量重试失败任务
- 新增 `0.0.11` Upgrade，用于更新插件版本记录

### 0.0.10

- 提示词优化支持管理员配置模型池，用户端可在白名单模型中选择优化模型
- 新增 `GET /generation/prompt/options` Web API，用户端读取默认优化模型、可选模型和计费状态
- 提示词优化按主站对话 token 口径计费：优先使用主站模型 `billingRule`，公式为 `ceil(totalTokens / tokens * power)`
- AI Provider 未返回 usage 时使用 `generateTextWithUsage` 估算 token，保证计费有兜底
- Console 配置页新增按 token 计费开关、兜底 `power/tokens` 与预检 token 数
- 新增 `0.0.10` Upgrade，补齐提示词优化模型池与计费配置列

### 0.0.9

- P1 用户工作台增强：后端计费估算接入表单、复制参数再生成、失败任务沿用参数重试、历史页时间/账务/排序筛选
- P1 提示词优化历史：生成记录保存原始提示词、优化来源、优化风格和主站模型 ID
- P2 管理运营增强：任务详情新增管理员备注、失败分类、状态时间线、标记失败、批量标记失败、超时任务扫描
- P2 配置审计：供应商配置保存/清除写入脱敏审计表
- P3 稳定性增强：Provider 错误归一化、状态事件、超时扫描、失败退款复用、Webhook 幂等保护继续沿用终态短路
- P4 架构整理：新增 `VideoProviderAdapter`、`ProviderRegistryService`、`HappyHorseAdapter`
- P5 多供应商预留：Kling、Seedance/ARK、DashScope Video、RunningHub/ComfyUI 在管理端显示为 reserved，不开放用户生成
- 短视频制作预留入口：用户端 `/studio`、管理端 `/console/studio`
- 新增 `0.0.9` Upgrade，补齐生成记录运营字段与配置审计表

### 0.0.8

- 前置开发提示词优化能力：用户端生成前可一键优化当前提示词
- 新增 `POST /generation/prompt/optimize` Web API
- 提示词优化优先调用主站已配置 AI 模型；未配置或模型不可用时使用本地规则优化兜底
- Console 配置页新增提示词优化开关和主站 AI 模型 ID
- 新增 `0.0.8` Upgrade，幂等补齐 `prompt_optimizer_enabled` 与 `prompt_optimizer_model_id`
- 插件依赖补充 `@buildingai/ai-sdk`，用于基于主站模型执行文本生成

### 0.0.7

- HappyHorse 供应商配置从“只配 API Key”扩展为完整运行配置：Base URL、请求超时、测试超时、重试次数、重试延迟、启用状态
- Webhook Secret 改为 Console 配置和插件内加密保存，不再从环境变量读取
- HappyHorse 提交、轮询、连接测试、健康检查统一读取后台配置
- Console 配置页补齐运行参数表单和 Webhook Secret 状态
- Console 管理首页补 HappyHorse 健康状态、启用模型数、处理中任务数、Webhook 配置状态
- 新增 `0.0.7` Upgrade，幂等补齐 `video_provider_config` 运行配置列
- 文档明确当前模块是通用视频工作台，完整短视频制作后置为独立模块或大版本

## 架构

```text
extensions/echoflow-video/
├── manifest.json
├── package.json
├── src/
│   ├── api/
│   │   ├── db/entities/
│   │   └── modules/
│   │       ├── generation/
│   │       ├── provider-config/
│   │       ├── model-config/
│   │       ├── billing/
│   │       ├── policy/
│   │       └── template/
│   └── web/
│       ├── components/
│       ├── pages/
│       ├── pages/console/
│       ├── services/web/
│       ├── services/console/
│       └── types/
```

核心原则：

- `GenerationService` 编排任务，当前只允许 HappyHorse 模型进入提交链路
- 后续多供应商版本再通过 `VideoProviderAdapter` 处理鉴权、提交、轮询、回调、错误归一化
- Provider、Model、Billing、Policy、Template 配置独立建模
- 任务记录保存 provider、taskId、modelConfigId、模型快照、计费快照、raw request/response 摘要和失败原因
- 插件业务密钥不放 `.env`，优先走 Console 配置或平台 Secret

## 用户端

访问路径：`/extension/echoflow-video/`

用户端直接展示视频生成工作台，不做营销落地页。应提供：

- 从后台读取可见模型，不写死 HappyHorse 枚举
- 生成前提示词优化：可选择管理员开放的优化模型和电影感、商业、写实、动漫、简洁等风格，并一键替换当前提示词
- 按模型能力动态展示表单：
  - 文生视频：prompt、时长、比例、分辨率、水印
  - 图生视频：首帧图 + prompt
  - 参考图生视频：1-4 张参考图 + prompt
  - 视频编辑或动作迁移：视频 + 可选参考图 + prompt
- 素材上传、类型校验、大小限制、预览和后端 URL/文件类型复核
- 生成前算力预估和 `requestKey` 幂等提交
- 任务状态展示：排队中、生成中、成功、失败、当前轮询间隔、失败原因
- 结果播放、复制链接、下载、复制参数再生成
- 个人历史、详情页、关键词/状态/模型/账务/时间筛选

用户端不展示 API Key、Base URL、全局计费配置、其他用户记录或未脱敏上游响应。

## 管理端

访问路径：`/extension/echoflow-video/console/`

### 供应商配置

- HappyHorse API Key、Base URL、启用状态
- 连接测试、请求超时、测试超时、重试次数、重试延迟
- Webhook Secret 加密保存，回调从 Console 配置校验
- 长期支持绑定平台 Secret，插件内加密保存作为 fallback

### 模型管理

- 模型 ID、展示名、供应商、能力类型
- 输入素材要求、时长范围、分辨率列表、比例列表
- 是否启用、是否用户可见、排序

### 计费与风控

- 全局默认规则
- 按模型配置基础费用、每秒费用、分辨率倍率
- 失败是否退款
- 预估与实际扣费使用同一规则
- 用户、IP、provider、model 分层限流

### 模板与任务运维

- Prompt 模板：标题、分类、prompt、适用模型/能力、启用、排序
- 全站历史：按用户、模型、状态、计费状态筛选
- 批量刷新处理中任务、失败任务重试
- 详情查看 rawRequest/rawResponse 摘要、requestKey、耗时、状态时间线、扣费/退款状态
- 管理员备注、失败分类、批量标记失败、超时任务扫描
- 健康检查：DB、Provider 连接、模型配置完整度、最近失败原因统计

## 配置

在 BuildingAI 管理端配置 HappyHorse 供应商：

`/extension/echoflow-video/console/config`

插件不从环境变量读取业务 API Key 或 Webhook Secret。生产环境若继续使用插件内加密密钥，需要配置加密密钥；长期建议支持平台 Secret 后绑定 `secretId`。

### HappyHorse 管理员配置项

| 字段 | 默认值 | 说明 |
|------|--------|------|
| API Key | 空 | HappyHorse 鉴权密钥，仅后端加密保存，不回显明文 |
| Base URL | `https://api.echoflow.cn` | HappyHorse API 网关地址，可用于代理网关或私有转发 |
| 请求超时 | `120000` ms | 提交任务和轮询状态的单次请求超时 |
| 测试超时 | `15000` ms | Console 连接测试请求超时 |
| 重试次数 | `2` | 429、5xx、timeout、连接中断等错误的最大重试次数 |
| 重试延迟 | `1000` ms | 指数退避基础延迟 |
| Webhook Secret | 空 | 配置后 Webhook 必须携带 `x-webhook-secret` |
| 提示词优化 | 启用 | 用户端生成前的提示词优化开关 |
| 提示词优化模型 ID | 空 | 默认主站 AI 模型 ID；留空使用本地规则 |
| 提示词优化模型池 | 空 | 每行一个主站 AI 模型 ID，用户端只能在默认模型和模型池里选择 |
| 提示词优化 token 计费 | 启用 | 按主站对话 token 口径扣费，优先使用模型自身 `billingRule` |
| 提示词优化兜底计费 | `1 / 1000 tokens` | 当模型未配置有效规则时使用 |
| 提示词优化预检 tokens | `500` | 优化前余额预检使用，实际扣费按真实或估算 usage |
| 启用状态 | 启用 | 关闭后用户端不能提交 HappyHorse 任务 |

### 管理员操作流程

1. 进入 `/extension/echoflow-video/console/config`
2. 填写 HappyHorse API Key，确认 Base URL、超时和重试参数
3. 按需开启提示词优化；如需 AI 优化，填写默认主站 AI 模型 ID，并配置允许用户选择的模型池
4. 点击“测试连接”，确认 HappyHorse 鉴权和网关可用
5. 如需回调，设置 Webhook Secret，并在 HappyHorse 回调侧使用同一密钥
6. 开启 HappyHorse 后，在用户端优化提示词并提交测试任务
7. 到 Console 历史页或管理首页检查任务状态、扣费状态和健康检查结果

### 常见排障

| 现象 | 优先检查 |
|------|----------|
| 用户端提示未配置或未启用 | Console 配置页是否保存 API Key，启用开关是否打开 |
| 连接测试失败 | API Key 是否有效，Base URL 是否可访问，测试超时是否过短 |
| 任务一直处理中 | HappyHorse taskId 是否存在，批量刷新是否可更新状态，轮询请求是否超时；可在 Console 执行超时扫描 |
| Webhook 无效 | HappyHorse 回调 URL 是否正确，`x-webhook-secret` 是否与 Console 配置一致 |
| 提示词优化使用本地规则 | Console 未配置主站 AI 模型 ID，或主站模型/密钥不可用 |
| 用户端看不到可选优化模型 | Console 未填写默认模型或模型池，或对应主站模型不存在/未启用 |
| 扣费后提交失败 | 记录应进入失败并触发退款；若退款失败，管理员在详情页复核账务状态 |

## API 边界

Web 接口挂载在 `/echoflow-video/api/` 下，Console 接口挂载在 `/echoflow-video/consoleapi/` 下，均需登录态。

| 通道 | 用途 |
|------|------|
| Web API | 当前用户生成、历史、详情、状态刷新、算力预估、模板读取 |
| Console API | 供应商配置、模型管理、计费规则、风控策略、模板管理、全站历史、批量运维、健康检查 |

## 主站能力复用

已使用能力：

- `@ExtensionEntity()`
- `@ExtensionWebController()` / `@ExtensionConsoleController()`
- `@Playground()`
- `createPluginHttpClients()`
- `uploadFileAuto()`
- `BaseService`
- `paginate`
- `ExtensionBillingService`

优先补强：

- 使用 `ExtensionBillingModule` 统一提供扣费/退款服务，业务侧只保留 `VideoBillingRule`
- 提示词优化已接入 `PublicAiModelService` 与 `@buildingai/ai-sdk`，优先使用主站模型配置
- 提示词优化计费复用主站对话 token 口径：`ceil(totalTokens / tokens * power)`，优先读取主站模型 `billingRule`
- 需要脚本、分镜、素材分析、VLM 时继续复用 `AiPublicModule` / `PublicAiModelService`
- 支持 `SecretService` / 平台 Secret，Provider 配置保存 `secretId`
- 长任务、自动轮询、批量任务、完整短视频流水线使用队列/worker，不写内存队列
- 当前仍使用插件内存 `RateLimitGuard`；接入主站 Redis/Cache 前，不改主系统只读区
- 文件记录保存 fileId、相对路径或平台文件字段，列表/详情用统一文件 URL 能力转换
- 多供应商后统一 `ProviderHttpClient`，负责超时、重试、代理、脱敏和错误归一化

## 开发

```bash
# 安装依赖
pnpm install --filter echoflow-video

# API 开发模式
pnpm --dir extensions/echoflow-video dev:api

# Web 开发模式
pnpm --dir extensions/echoflow-video dev:web

# 同时启动
pnpm --dir extensions/echoflow-video dev

# 构建
pnpm --dir extensions/echoflow-video build:api
pnpm --dir extensions/echoflow-video build:web

# 类型检查
pnpm --dir extensions/echoflow-video check-types

# 单测：类型检查 + Jest
pnpm --dir extensions/echoflow-video test

# Lint
pnpm --dir extensions/echoflow-video lint

# 发布构建
pnpm --dir extensions/echoflow-video build:publish
```

## 种子数据

插件当前通过升级脚本初始化 4 个默认 HappyHorse 视频模型，并由 `GET /generation/options/models` 返回给用户端：

- `happyhorse-1.0-t2v`：文生视频
- `happyhorse-1.0-i2v`：图生视频，首帧驱动
- `happyhorse-1.0-r2v`：参考视频生成
- `happyhorse-1.0-video-edit`：视频编辑

默认模型写入插件自己的 `video_model_config` 表，升级脚本需要保持幂等，避免重复插入。发布或升级前从插件根目录执行发布构建：

```bash
pnpm buildingai extension:release
```

管理员在 BuildingAI Console 的 `/extension/echoflow-video/console/config` 配置 HappyHorse。插件读取自己的管理员配置表，不要求把业务 API Key 写入环境变量。

可配置字段包括：

- API Key
- Base URL
- 请求 / 测试超时
- 重试次数和重试间隔
- Webhook Secret
- 启用状态

## 质量基线

本插件当前单测放在 `tests/api`，测试桩也仅放在 `tests/api/test-utils`，不要放回 `src/api`，避免发布包携带测试专用代码。生产 API 构建入口只包含 `src/api` 运行时代码。

当前已验证命令：

- `pnpm --filter echoflow-video test`：通过，包含 `vue-tsc --noEmit` 和 27 个 Jest 单测
- `pnpm --filter echoflow-video lint`：通过
- `pnpm --filter echoflow-video build:api`：通过
- `pnpm --filter echoflow-video build:web`：通过，存在 Vite chunk 体积警告
- `pnpm --filter echoflow-video build:publish`：通过，存在 Vite chunk 体积警告

后续每次改动至少跑 `pnpm --filter echoflow-video test`。涉及前端页面、发布包、Upgrade 或构建配置时，还要跑 `lint`、`build:web`、`build:api` 和 `build:publish`。

## 后续完整开发任务

当前结论：

- 通用视频工作台的插件内功能主干已完成：用户端生成、历史、详情、提示词优化、素材上传、参数复用；管理端配置、模型、计费、风控、模板、历史、运维、审计、健康统计均已具备。
- 尚未完成的不属于“通用工作台页面功能”的部分，主要是：真实 HappyHorse Key 联调、真实主站环境联调、队列/Redis/E2E 等生产化、多供应商真实接入，以及短视频制作独立页面。
- 短视频制作保留在 `echoflow-video` 插件内作为独立页面和独立后端模块规划，不塞进当前首页单任务生成表单。
- 下一阶段不要优先扩新页面，先完成真实供应商联调和主站环境联调；短视频页面只保留入口，进入独立排期。

### 下一阶段优先级

1. HappyHorse 真实闭环：真实 Key、四类模型 payload、素材上传 URL、状态映射、Webhook、失败退款、提示词优化到生成。
2. 主站环境联调：插件安装、Upgrade、Console 配置保存、用户端生成、账务扣费、文件 URL、重启后页面可用。
3. 生产化可靠性：队列/worker 自动轮询、Redis/Cache 限流、E2E、升级回归。
4. 安全与运维：平台 Secret 绑定、配置审计筛选、失败退款复核台账、发布前 smoke checklist。
5. 短视频制作独立页：只做独立模块规划，不并入当前通用生成表单。

### P0：HappyHorse 真实可用闭环

- [x] Console 供应商配置、连接测试、超时、重试、Webhook Secret
- [x] Console 风控策略提供用户并发与每日任务限制
- [x] Console 模型管理，用户端模型从后台读取
- [x] Console 计费规则，生成前预估和失败退款
- [x] Console Prompt 模板，用户端只读使用
- [x] 用户端提示词优化前置能力
- [x] Web 按模型能力动态表单和素材上传校验
- [ ] HappyHorse 四类视频模式真实 Key 端到端联调
- [x] 后端按模型能力校验参数
- [x] 任务历史、详情、刷新、失败原因和账务状态闭环
- [ ] 校验 T2V、I2V、R2V、VIDEO_EDIT 的真实请求 payload、媒体字段和参数映射
- [ ] 记录 HappyHorse 返回状态全集，补齐 pending/running/succeeded/failed/cancelled 等状态映射
- [ ] 真实回调测试：成功、失败、重复回调、缺少 taskId、Secret 错误
- [ ] 失败退款联调：提交失败、上游失败、taskId 丢失、重复退款保护
- [ ] 提示词优化真实模型联调：主站模型 ID、Provider Secret、失败 fallback、优化结果可生成
- [ ] 4090 完整主站联调：当前主系统 notification TypeScript 错误需单独授权后处理

### P1：用户端通用工作台完善

- [x] 结果操作：下载视频、复制视频链接、复制参数再生成
- [x] 失败任务操作：查看原因、沿用素材再生成
- [x] 历史筛选增强：模型、状态、时间范围、关键词、排序、账务状态
- [x] 详情页增强：任务耗时、扣费状态、退款状态、requestKey、上游 taskId
- [x] 计费估算改为优先调用后端估算接口，前端 fallback 只做离线兜底
- [x] 提示词优化历史：保留原始提示词、优化提示词、来源、风格
- [x] 提示词优化计费策略：按主站对话 token 口径计费，用户端可选择管理员开放的优化模型
- [x] 上传素材保存 fileId、URL、mimeType、size、fileName，详情页展示平台上传 URL 和素材元数据
- [x] 前端轮询智能降频：3s -> 6s -> 10s -> 20s

### P2：管理员运营能力

- [x] Admin 批量轮询端点：`POST /consoleapi/generation/batch/status`
- [x] Admin 详情页增强：rawRequest/rawResponse、任务耗时、requestKey、状态时间线
- [x] Admin 任务详情补 failureCategory、providerTaskId、管理员备注
- [x] 批量运维：批量刷新、标记失败、取消、失败重试、失败退款复核
- [x] 配置审计：Provider 配置保存/清除脱敏审计，并在 Console 配置页展示
- [x] 健康检查：HappyHorse 配置、连接、模型数量、处理中任务
- [x] 健康检查增强：长时间 processing 超时扫描
- [x] 健康检查增强：Provider 5xx 统计、最近失败原因统计、模型配置完整度
- [x] API Key 与 Webhook Secret 插件内加密存储
- [ ] 平台 Secret 绑定，Provider 配置保存 `secretId`

### P3：稳定性与生产化

- [ ] 队列/worker 自动轮询，减少对用户页面轮询和手动批量刷新的依赖
- [ ] Redis/Cache 限流替代当前内存级防护
- [x] 幂等增强：提交、扣费、退款、Webhook 重复回调都可安全处理
- [x] Provider 错误归一化：鉴权失败、余额不足、参数错误、限流、服务不可用
- [ ] E2E：用户生成流程、Console 配置、模型 CRUD、计费 CRUD、策略 CRUD
- [ ] 发布升级联调：版本识别、Upgrade 执行、旧数据保留、storage 保留、服务重启后页面可打开

### P4：架构扩展，但暂不接多供应商

- [x] 抽象 `VideoProviderAdapter`
- [x] HappyHorse 实现统一 Adapter
- [x] Provider Registry 按 `providerId` 路由
- [x] 提交、轮询、Webhook、错误归一化统一接口化
- [x] 当前只注册 HappyHorse，避免未联调供应商进入用户端

### P5：多供应商后置

- [x] Kling 后台 reserved 占位
- [x] Seedance/ARK 后台 reserved 占位
- [x] DashScope video 后台 reserved 占位
- [x] RunningHub/ComfyUI 工作流型供应商后台 reserved 占位
- [ ] 接入真实供应商 API、计费、模型能力和媒体合同

### P6：高级视频能力

- [ ] 素材分析与 Prompt 生成，优先使用 `AiPublicModule` / `PublicAiModelService`
- [ ] 动作迁移
- [ ] 数字人口播轻量版
- [ ] 批量任务
- [x] HappyHorse Webhook 回调
- [ ] Playwright E2E

### P7：短视频制作独立页面

- [x] 用户端和管理端入口预留
- [ ] 用户端独立页面 `/extension/echoflow-video/studio`：项目式短视频工作台
- [ ] 管理端独立页面 `/extension/echoflow-video/console/studio`：项目、任务、成本和失败运维
- [ ] 后端独立模块 `studio`：不要复用普通单任务 `generation` Controller 承载完整短视频流程
- [ ] 数据模型：`VideoStudioProject`、`VideoStudioScene`、`VideoStudioAsset`、`VideoStudioJob`
- [ ] 主题到完整短视频：脚本、分镜、图片/视频片段、TTS、BGM、字幕和视频合成
- [ ] 项目式工作流：草稿、版本、素材库、分镜状态、片段状态
- [ ] 分镜工作流：主题生成脚本、脚本拆分镜、分镜 Prompt 优化、单分镜视频生成
- [ ] 单分镜操作：编辑、复制 Prompt、重试、替换素材、锁定已满意片段
- [ ] 一键生成全部分镜视频，并允许失败分镜单独重试
- [ ] TTS 配音、BGM、字幕和合成作为第二阶段，不阻塞短视频页面 MVP
- [ ] 队列式长任务：脚本生成、分镜生成、素材生成、配音、字幕、合成

该能力是同插件内的独立页面/工作台，不是营销落地页；MVP 先做“主题 -> 脚本 -> 分镜 -> 分镜视频生成”，TTS、BGM、字幕、合成再后置。

## 参考与许可

`.agents/references/Pixelle-Video` 仅作为能力参考，不复制页面、代码、文案或资源。可参考的方向包括 direct media providers、模型元数据、模式/流水线、模板、素材管理、历史和运维能力。

Pixelle 的 Streamlit 页面结构不适合作为 BuildingAI 插件前端实现；本插件继续按 Web 用户端、Console 管理端、Web API、Console API 四条边界拆分。
