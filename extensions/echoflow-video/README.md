# AI视频工作台

面向创作者的 BuildingAI AI 视频生成插件。当前按固定 P0 模型目录接入 Seedance、Kling 和 HappyHorse 视频能力；管理员不配置供应商，只为每个固定模型维护一组或多组主站 Secret 接入点。

插件定位是“用户视频创作台 + 管理员视频运营台”：用户端只做生成、历史和结果查看；管理员端负责模型接入点、计费、模板、风控和任务运维。

## 当前状态

- 版本：`0.0.1`
- 当前模型体系：固定 P0 模型目录 + 模型级接入点
- 当前边界：核心通用视频工作台，暂不包含脚本、分镜、TTS、BGM、字幕和多片段合成
- 已有能力：插件实体、Web/Console 双入口、双 Controller、双 HTTP client、前端上传、插件扣费、任务历史、固定 P0 视频模型目录、模型级多接入点配置、计费规则、模板预设、提示词优化、优化模型选择、按对话 token 计费、素材元数据、基础风控、批量运维、任务备注、状态时间线、失败分类、配置审计列表、健康统计、短视频制作预留入口、Webhook Secret 和异步终态加锁写回
- 下一目标：使用真实主站 Secret 完成 Seedance、Kling、HappyHorse P0 模型端到端联调，并验证提示词优化到生成的完整体验
- 2026-06-14 审查结论：用户端/管理端边界已按 Web API、Console API、Web service、Console service 分离；通用工作台功能主干已完成，剩余工作集中在真实联调、生产化队列/缓存/E2E、平台 Secret 绑定和短视频独立页面
- 2026-06-15 审查结论：当前仍按未上线首版 `0.0.1` 收口，所有表结构、默认配置和初始化逻辑合并进首版 Upgrade；已补齐文件归属校验、计费幂等、模型删除保护、baseURL 校验和提示词优化幂等状态保护，发布前仍需做真实供应商 smoke。
- 2026-06-16 审查修复：首版 Upgrade 的 PostgreSQL 参数已显式类型转换，避免空库安装时 `could not determine data type of parameter`；提示词优化模型校验改为复用主系统 `AiPublicModule` / `PublicAiModelService`，不再直接注入主系统模型仓库。

## 首版能力快照

- 修复管理端禁用/隐藏模型后，用户端仍可能通过默认模型兜底提交的问题
- 视频生成扣费与任务 `billingStatus` 更新改为事务绑定，失败退款也同步保存账务和业务状态
- Webhook 未配置 Secret 时不再信任公开回调，避免外部请求直接改写任务终态
- Webhook、轮询、超时扫描和取消写回终态前会重新加锁；已成功或失败的任务不会被旧轮询对象覆盖，成功任务也不会被失败分支退款
- 用户端限流从整个 Controller 收窄到生成提交和提示词优化，避免模型/模板/轮询请求误伤
- 主站上传素材的插件文件 URL 允许带 `fileId` 的本地/内网上传路径通过校验，外部 URL 仍保留 SSRF 防护
- 风控策略开始校验上传素材 size，执行管理端配置的图片/视频大小限制
- 提示词优化内置幂等记录表 `video_prompt_optimization`，同一 `requestKey` 不重复扣费；命中 `PENDING` / `FAILED` 记录时不会返回占位优化结果
- 配置审计记录管理员 `operatorId`
- `pnpm test` 改为类型检查 + Jest 单测，并替换已漂移的旧单测；测试文件迁移到 `tests/api`，避免混入发布源码
- 当前所有字段、默认值和初始化数据都合并在 `src/api/upgrade/0.0.1/index.ts`，未上线前不再保留本地迭代版本号。

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

- `GenerationService` 编排任务，按 `model -> endpoint -> submitPath/pollPath` 提交与轮询
- 固定模型目录在代码中维护模型能力、协议路径、默认参数和外部模型 ID
- `VideoModelConfig.endpoints` 保存每个模型的一组或多组主站 Secret 引用，用户端只展示启用且已有可用接入点的模型
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

### 模型配置

- 固定 P0 视频模型由插件内置目录提供，不在 Console 手工新增或删除模型协议
- Console 只调整展示名、说明、启用状态、用户可见性、排序、默认参数和接入点
- 每个模型可配置多组接入点：名称、主站 Secret、可选 Base URL 覆盖、启用状态、优先级、超时和重试
- 生成时选择该模型优先级最高且已启用、已绑定主站 Secret 的接入点
- 输入素材要求、能力类型、时长范围、分辨率列表和比例列表来自内置模型定义，避免管理员误填导致提交协议漂移

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

视频生成接入点在模型配置页维护：

`/extension/echoflow-video/console/models`

插件不要求管理员配置供应商，也不从环境变量读取业务 API Key。每个固定模型可以维护多组接入点，适合官方渠道、代理渠道、私有网关或备用网关并存。运行时按模型选择启用、优先级最高且已绑定主站 Secret 的接入点。

### 模型接入点字段

| 字段 | 说明 |
|------|------|
| 名称 | 管理员识别用，例如官方、备用、代理网关 |
| 主站 Secret ID | 在主站密钥管理中创建，字段包含 `apiKey/api_key`，可选 `baseURL/baseUrl/base_url` |
| Base URL 覆盖 | 可选；留空时读取主站 Secret 中的 baseURL 字段 |
| 优先级 | 数字越小越优先；同一模型可配置多组备用接入点 |
| 请求超时 | 提交任务和轮询状态的单次请求超时 |
| 测试超时 | Console 连接测试请求超时 |
| 重试次数 | 429、5xx、timeout、连接中断等错误的最大重试次数 |
| 重试延迟 | 指数退避基础延迟 |
| 启用状态 | 关闭后该接入点不会进入运行选择 |

### 优化与回调配置

`/extension/echoflow-video/console/config` 只保留提示词优化和 Webhook Secret：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| Webhook Secret | 空 | 配置后 Webhook 必须携带 `x-webhook-secret` |
| 提示词优化 | 启用 | 用户端生成前的提示词优化开关 |
| 提示词优化模型 ID | 空 | 默认主站 AI 模型 ID；留空使用本地规则 |
| 提示词优化模型池 | 空 | 每行一个主站 AI 模型 ID，用户端只能在默认模型和模型池里选择 |
| 提示词优化 token 计费 | 启用 | 按主站对话 token 口径扣费，优先使用模型自身 `billingRule` |
| 提示词优化兜底计费 | `1 / 1000 tokens` | 当模型未配置有效规则时使用 |
| 提示词优化预检 tokens | `500` | 优化前余额预检使用，实际扣费按真实或估算 usage |

### 管理员操作流程

1. 进入 `/extension/echoflow-video/console/models`
2. 选择一个固定模型，确认启用、用户可见和默认参数
3. 为该模型新增至少一个接入点，选择主站 Secret，按需填写 Base URL 覆盖、超时、重试和优先级
4. 点击接入点测试，确认鉴权和网关可达
5. 按需进入 `/extension/echoflow-video/console/config` 配置提示词优化模型池和 Webhook Secret
6. 在用户端提交测试任务，到 Console 历史页或管理首页检查任务状态、扣费状态和健康统计

### 常见排障

| 现象 | 优先检查 |
|------|----------|
| 用户端看不到模型 | 模型是否启用、用户可见，且至少有一个启用并绑定主站 Secret 的接入点 |
| 接入点测试失败 | 主站 Secret 是否包含有效 `apiKey/api_key`，baseURL 是否可访问，测试超时是否过短 |
| 任务一直处理中 | 上游 taskId 是否存在，批量刷新是否可更新状态，轮询请求是否超时；可在 Console 执行超时扫描 |
| Webhook 无效 | 回调 URL 是否正确，`x-webhook-secret` 是否与 Console 配置一致 |
| 提示词优化使用本地规则 | Console 未配置主站 AI 模型 ID，或主站模型/密钥不可用 |
| 用户端看不到可选优化模型 | Console 未填写默认模型或模型池，或对应主站模型不存在/未启用 |
| 扣费后提交失败 | 记录应进入失败并触发退款；若退款失败，管理员在详情页复核账务状态 |

## API 边界

Web 接口挂载在 `/echoflow-video/api/` 下，Console 接口挂载在 `/echoflow-video/consoleapi/` 下，均需登录态。

| 通道 | 用途 |
|------|------|
| Web API | 当前用户生成、历史、详情、状态刷新、算力预估、模板读取 |
| Console API | 模型接入点、优化配置、计费规则、风控策略、模板管理、全站历史、批量运维、健康检查 |

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
- 提示词优化已接入 `AiPublicModule` / `PublicAiModelService` 与 `@buildingai/ai-sdk`，优先使用主站模型配置
- 提示词优化计费复用主站对话 token 口径：`ceil(totalTokens / tokens * power)`，优先读取主站模型 `billingRule`
- 需要脚本、分镜、素材分析、VLM 时继续复用 `AiPublicModule` / `PublicAiModelService`
- 视频生成当前不直接塞进主站 `ai_models`：主站现有模型类型没有文生视频、图生视频、视频编辑等异步生成类型，插件在内置模型目录里维护提交、轮询、Webhook、素材校验和结果 URL 安全；后续若主系统新增视频生成模型抽象，再迁移为主站模型
- 后续支持 `SecretService` / 平台 Secret，模型接入点保存 `secretId`；首版暂留插件内 AES-GCM，避免把强加密降级为当前 SecretService 的简化字段加密
- 长任务、自动轮询、批量任务、完整短视频流水线使用队列/worker，不写内存队列
- 当前 Web 提交限流已复用主系统 `@buildingai/cache` 的 `CacheService`；分布式 Redis 限流仍作为生产化增强，不改主系统只读区
- 文件记录保存 fileId、相对路径或平台文件字段，列表/详情用统一文件 URL 能力转换
- 兼容视频网关客户端统一负责超时、重试、脱敏和错误归一化

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

插件当前通过升级脚本初始化固定 P0 视频模型；运行时如果发现缺失，也会自动补齐。只有启用、用户可见且至少有一个可用接入点的模型，才会由 `GET /generation/options/models` 返回给用户端：

- `doubao-seedance-2-0-260128`：Seedance 2.0
- `doubao-seedance-1-5-pro-251215`：Seedance 1.5 Pro
- `kling-text2video`：可灵文生视频
- `kling-image2video`：可灵图生视频
- `kling-multi-image2video`：可灵多图参考生视频
- `happyhorse-1.0-t2v`：文生视频
- `happyhorse-1.0-i2v`：图生视频，首帧驱动
- `happyhorse-1.0-r2v`：参考视频生成
- `happyhorse-1.0-video-edit`：视频编辑

默认模型写入插件自己的 `video_model_config` 表，升级脚本需要保持幂等，避免重复插入。Console 不再新增或删除模型，只允许调整运营字段和模型接入点；模型协议字段始终以插件内置定义为准。发布或升级前从插件根目录执行发布构建：

```bash
pnpm buildingai extension:release
```

管理员在 BuildingAI Console 的 `/extension/echoflow-video/console/models` 为每个模型配置接入点。插件读取模型自己的接入点配置，不要求把业务 API Key 写入环境变量。

每个接入点可配置字段包括：

- 名称
- Base URL
- API Key
- 优先级
- 请求 / 测试超时
- 重试次数和重试间隔
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
- 尚未完成的不属于“通用工作台页面功能”的部分，主要是：真实 P0 模型 Key 联调、真实主站环境联调、队列/Redis/E2E 等生产化，以及短视频制作独立页面。
- 短视频制作保留在 `echoflow-video` 插件内作为独立页面和独立后端模块规划，不塞进当前首页单任务生成表单。
- 下一阶段不要优先扩新页面，先完成真实供应商联调和主站环境联调；短视频页面只保留入口，进入独立排期。

### 下一阶段优先级

1. P0 视频模型真实闭环：Seedance、Kling、HappyHorse 的真实 Key、payload、素材上传 URL、状态映射、Webhook、失败退款、提示词优化到生成。
2. 主站环境联调：插件安装、Upgrade、Console 配置保存、用户端生成、账务扣费、文件 URL、重启后页面可用。
3. 发布升级联调：`build:publish` / `extension:release`、版本识别、Upgrade 幂等、旧数据和 storage 保留。
4. 生产化可靠性：队列/worker 自动轮询、Redis 分布式限流、E2E、失败退款复核台账。
5. 安全与运维：平台 Secret 绑定、模型接入点保存 `secretId`、配置审计筛选、发布前 smoke checklist。
6. 短视频制作独立页：只做独立模块规划，不并入当前通用生成表单。

### P0：固定模型真实可用闭环

- [ ] Seedance 2.0、Seedance 1.5 Pro、Kling 和 HappyHorse 真实 Key 端到端联调
- [ ] 校验文生视频、首帧图生视频、多参考图生视频、视频编辑的真实请求 payload、媒体字段和参数映射
- [ ] 记录各模型返回状态全集，补齐 pending/running/succeeded/failed/cancelled 等状态映射
- [ ] 接入点测试覆盖 200、401/403、404 task missing、429、5xx 和 timeout
- [ ] 真实回调测试：成功、失败、重复回调、缺少 taskId、Secret 错误
- [ ] 失败退款联调：提交失败、上游失败、taskId 丢失、重复退款保护
- [ ] 提示词优化真实模型联调：主站模型 ID、模型密钥、失败 fallback、优化结果可生成
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
- [x] 配置审计：兼容配置保存/清除脱敏审计，并在 Console 配置页展示
- [x] 健康检查：模型接入点完整度、模型数量、处理中任务
- [x] 健康检查增强：长时间 processing 超时扫描
- [x] 健康检查增强：上游 5xx 统计、最近失败原因统计、模型配置完整度
- [x] API Key 与 Webhook Secret 插件内加密存储
- [ ] 平台 Secret 绑定，模型接入点保存 `secretId`
- [ ] 配置审计筛选与导出，便于发布前复核管理员配置变更
- [ ] 失败退款复核台账，按任务、账务状态和退款失败原因筛选

### P3：稳定性与生产化

- [ ] 队列/worker 自动轮询，减少对用户页面轮询和手动批量刷新的依赖
- [x] Web 提交限流复用主系统 `CacheService`，替代插件自管 Map / 定时器
- [ ] Redis 分布式限流替代当前默认内存 Cache 后端
- [x] 幂等增强：提交、扣费、退款、Webhook 重复回调都可安全处理
- [x] 上游错误归一化：鉴权失败、余额不足、参数错误、限流、服务不可用
- [ ] E2E：用户生成流程、Console 配置、模型 CRUD、计费 CRUD、策略 CRUD
- [ ] 发布升级联调：版本识别、Upgrade 执行、旧数据保留、storage 保留、服务重启后页面可打开
- [ ] `build:publish` / `extension:release` 发布包检查，确认 `tests/api` 不进入发布包、`README.md` 和 `storage/static` 正确携带

### P4：模型网关扩展

- [x] 固定模型目录维护模型能力、协议路径、默认参数和外部模型 ID
- [x] 单模型支持多组 Base URL / API Key 接入点
- [x] 提交、轮询、Webhook、错误归一化统一接口化
- [x] 用户端只展示已启用、用户可见且存在可用接入点的模型
- [ ] 新增视频模型时只扩展内置目录和 payload 映射，不引入供应商配置页面

### P6：高级视频能力

- [ ] 素材分析与 Prompt 生成，优先使用 `AiPublicModule` / `PublicAiModelService`
- [ ] 动作迁移
- [ ] 数字人口播轻量版
- [ ] 批量任务
- [x] Webhook 回调
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

## 后端业务逻辑审查（2026-06-15）

### 本轮已修复

| 模块 | 修复点 | 当前状态 |
|------|--------|----------|
| Model Endpoint | `baseURL` 现在强制 `http(s)`、禁止凭证片段，并会拒绝本机和内网地址。 | 管理端不会再保存明显非法的模型接入点。 |
| Model Endpoint | 每个固定模型可保存多组接入点，运行时只选择启用、有密钥且优先级最高的接入点。 | 支持官方、代理、私有网关和备用网关并存。 |
| Model Endpoint | 保存和测试配置时都会校验超时、重试、提示词优化兜底参数的合法范围；默认/模型池提示词优化模型会重新校验启用状态与 LLM 类型。 | 避免异常运行参数和失效主站模型进入配置。 |
| Model Config | 创建/更新和用户端读取时只允许当前插件内置的固定 P0 模型；删除前检查计费、策略、模板和历史引用。 | 避免保存不可用模型、展示历史坏配置和制造孤儿配置。 |
| Policy / Media | 外部媒体 URL 默认关闭；当前生成链路要求素材必须先通过平台上传并提交 `fileId`。 | 解决了素材归属、大小/MIME 信任来源和默认 SSRF 风险。 |
| Generation | 生成结果 URL 做协议、凭证和内网 host 校验，`PENDING` / `PROCESSING` 状态不能删除。 | 解决了结果地址和任务删除边界问题。 |
| Billing | 扣费 / 退款已用悲观锁、账务日志和业务状态事务绑定。 | 重试、恢复和失败分支不会重复扣退。 |
| Generation | Webhook、手动轮询、超时扫描和取消在状态写回前重新加锁并短路终态记录。 | 防止并发回调和轮询用旧对象覆盖成功结果或触发成功后的失败退款。 |
| Prompt Optimization | 提示词优化记录先落库，AI 优化按预估 token 预扣，失败回退本地优化时事务退款；相同 `requestKey` 只复用已完成记录，`PENDING` / `FAILED` 会明确提示稍后重试或重新提交。 | 解决了重复优化重复扣费、处理中结果误复用和模型失败未退款问题；仍需关注预估 token 与真实 token 的策略偏差。 |
| Prompt Optimization | 用户端读取模型池和实际优化前都会重新过滤/校验主站模型状态、Provider 状态和 LLM 类型，默认模型失效时回退到第一个可用模型。 | 避免保存后主站模型被禁用或改类型，用户端仍继续展示或调用旧配置。 |
| Web Templates | `/generation/options/templates` 兼容端点支持传入模板查询参数，返回 abilityTypes 和 modelConfigId。 | 快捷模板可以按当前能力过滤，避免不适配模型的模板混入用户端。 |
| Main System Reuse | Web 提交限流改为复用主系统 `CacheService`，生成模块导入 `AiPublicModule` 和 `ExtensionBillingModule`，Console 密钥脱敏复用 `maskSensitiveValue`。 | 移除插件自管限流 Map / 定时器和手写脱敏函数，减少手动注册 SDK Service。 |

### 仍需跟进

| 优先级 | 模块 | 问题 | 后续方案 |
|--------|------|------|----------|
| P1 | Release / Install | 当前版本已回收为未上线首版 `0.0.1`，发布前仍需要真实安装 smoke。 | 跑 `extension:release` / 安装验证，确认首版 Upgrade、发布产物和本地登记同步。 |
| P1 | Model Smoke | Seedance、Kling、HappyHorse 真实 Key、payload、Webhook 和失败退款还未跑端到端。 | 准备测试 Key、素材、测试用户和算力余额，跑真实任务并记录状态全集。 |
| P2 | Stability | 轮询和执行仍偏进程内，单机更顺手，多节点恢复能力有限。 | 接 Redis/BullMQ 或官方队列，减少对用户页面轮询和手动批量刷新依赖。 |
| P2 | Prompt Optimization | 提示词 AI 优化仍在请求路径内完成。 | 上游 LLM 慢或不稳定时，用户请求会被阻塞；后续可改为创建优化任务并轮询结果。 |
| P2 | Billing / Policy | 多条启用规则现在按最新创建记录命中，但缺少数据库唯一约束或显式优先级。 | 后续加显式优先级或唯一启用约束，并在 Console 展示最终命中规则。 |
| P2 | Secret | 首版暂留插件内 AES-GCM，尚未迁移到平台 Secret `secretId`。 | 等主系统 Secret 能满足强加密与运行时读取后，把模型接入点迁移为 `secretId` 绑定。 |
| P3 | Gateway Client | 当前固定模型目录和兼容网关客户端已经进入运行路径，旧 provider registry 仅剩兼容代码。 | 后续新增模型只扩展目录和 payload 映射，清理不再使用的 registry 预留面。 |

### 已确认较好的边界

- Web / Console 页面、service 和 Controller 已按用户端/管理端拆分。
- Webhook Secret 未配置时默认拒绝公开回调，避免无密钥改写终态。
- 生成扣费主流程已放入事务，优于先调用上游再扣费的模式。
