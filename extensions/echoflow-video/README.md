# 视频工作台

`echoflow-video` 是 EchoFlow 的视频工作台插件。用户端用文字或参考图生成视频，支持多模型选择、任务历史和结果查看；Console 负责主站视频模型开关、计费、模板、风控、提示词优化和任务运维。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 用户视频创作台 + 管理员视频运营台。 |
| 模型来源 | 复用主站已启用的视频模型，插件只维护可见性、能力覆盖和默认参数。 |
| 密钥来源 | 主站 AI Provider 管理密钥；插件不保存视频服务 API Key。 |
| 计费 | 模型级计费规则随固定模型配置维护；独立计费页不作为默认维护入口。 |
| 长流程 | 提交后通过主站视频模型 SDK 同步得到结果并转存；超时任务由定时扫描回收。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生视频/图生视频 | ready | 根据固定模型能力收敛用户端参数和素材要求。 |
| 模型目录 | ready | Console 从主站 active video models 读取候选模型，插件保存运营配置。 |
| 模型配置 | ready | 每个主站视频模型可配置用户可见性、能力覆盖、默认参数和排序。 |
| 模型级计费 | ready | 按模型基础费用、时长、分辨率倍率和失败退款配置预估与扣费。 |
| 提示词优化 | ready | 复用主站 LLM，优化扣费读取主站模型 `billingRule`。 |
| 终态保护 | ready | 超时扫描和取消写回前重新加锁；已终态记录不被旧对象覆盖。 |
| 主站通知 | ready | 视频终态通知提交到主站通知中心，由平台多渠道投递。 |
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复 + `@Cron("*/5 * * * *")` 定时 stale 扫描双路径，事务内悲观锁+CAS二次校验防止多实例重复入队。 |
| 短视频制作 | reserved | Web/Console 均保留页面入口，但当前不是默认上线能力。 |
| 真实供应商 smoke | pending | 仍需使用真实主站视频模型覆盖提交、失败退款和结果转存。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-video/*`；extension bundle / local dev base 是 `/extension/echoflow-video/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-video/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-video/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-video/` | `src/web/pages/index.tsx` | 视频生成工作台。 |
| Extension bundle/dev | `/extension/echoflow-video/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Extension bundle/dev | `/extension/echoflow-video/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Extension bundle/dev | `/extension/echoflow-video/studio` | `src/web/pages/studio.tsx` | 短视频制作 reserved 入口。 |
| Console route | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console route | `/console/models` | `src/web/pages/console/models.tsx` | 主站视频模型运营配置和模型级计费入口。 |
| Console route | `/console/policies` | `src/web/pages/console/policies.tsx` | 风控限流。 |
| Console route | `/console/templates` | `src/web/pages/console/templates.tsx` | 模板预设。 |
| Console route | `/console/history` | `src/web/pages/console/history.tsx` | 全量任务历史。 |
| Console route | `/console/config` | `src/web/pages/console/config.tsx` | 提示词优化模型。 |
| Console route | `/console/studio` | `src/web/pages/console/studio.tsx` | 短视频制作 reserved 管理入口。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web generation | `@ExtensionWebController("generation")` | 创建生成、查询任务、刷新状态。 |
| Web billing | `@ExtensionWebController("billing")` | 用户端生成费用预估。 |
| Web templates | `@ExtensionWebController("templates")` | 用户端模板读取。 |
| Console generation | `@ExtensionConsoleController("generation")` | 全量任务、详情、运维操作。 |
| Console models | `@ExtensionConsoleController("models")` | 固定模型配置和接入点。 |
| Console billing-rules | `@ExtensionConsoleController("billing-rules")` | 模型计费规则。 |
| Console policies | `@ExtensionConsoleController("policies")` | 风控策略。 |
| Console templates | `@ExtensionConsoleController("templates")` | 模板管理。 |
| Console config | `@ExtensionConsoleController("config")` | 只维护提示词优化模型。 |

关键服务：

| 服务 | 说明 |
|---|---|
| `GenerationService` | 任务创建、余额预检、预扣、主站视频生成、结果转存、退款和 public serializer。 |
| `ModelConfigService` | 主站视频模型列表、用户可见性和 capability 收敛。 |
| `ProviderConfigService` | 提示词优化模型和配置审计。 |
| `PromptOptimizationService` | 主站 LLM 提示词优化。 |

## 用户端边界

| 主题 | 说明 |
|---|---|
| 页面形态 | 用户端首页保持嵌入式业务工作台，不做营销 Hero、独立侧边栏、头像账号、全局余额或通知设置。 |
| 生成上下文 | 主系统已经提供外壳，插件只展示视频生成需要的上下文：生成方式、素材要求、提示词、扣费与失败退款说明、任务状态、结果操作和最近作品。 |
| capability | 文生视频、首帧图生、多参考图、视频编辑/动作迁移按模型能力收敛素材要求。 |
| 只读降级 | 无可用视频模型时，工作台保留说明和历史入口，但生成表单整体只读，避免用户误以为可以提交。 |
| 数据边界 | 用户端只消费 Web public 字段；历史参数复用不携带 Console 排障字段、provider 原始响应、内部失败分类或主系统模型 ID。 |

## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| 模型来源 | Console 从主站 active video models 读取候选模型，插件只保存用户可见性、能力覆盖、默认参数、排序和模型级计费。 |
| 素材 capability | 文生视频、首帧图生、多参考图、视频编辑/动作迁移按模型能力收敛素材要求。 |
| 提示词优化 | 复用主站 LLM，优化扣费读取主站模型 `billingRule`。 |
| 上传素材 | 素材必须通过平台上传并提交 `fileId`；后端校验上传者、插件归属、软删除、大小、MIME 和平台文件 URL。 |
| 任务与退款 | 任务保存状态时间线、失败分类和脱敏 raw 摘要；失败按账务事实退款。 |
| 结果转存 | provider 结果转存前经过安全 URL/存储边界，用户端只看 public serializer 字段。 |
| 通知 | 成功/失败终态注册为 `echoflow-video.generation.*`，由主站通知中心投递；投递失败不回滚任务。 |
| Reserved | 短视频制作 Web/Console 均保留弱入口，但当前不是默认上线能力。 |

## 数据与安全

| 主题 | 说明 |
|---|---|
| 任务记录 | 保存 provider、taskId、模型快照、计费快照、状态时间线、失败分类和脱敏 raw 摘要。 |
| 用户端返回 | public serializer 使用白名单字段，只返回用户可见任务、状态、账务、素材、参数和时间线；不返回 `taskId`、`adminRemark`、`rawRequest`、`rawResponse`、`billingRuleSnapshot`、`failureCategory` 或内部状态来源。 |
| 模型配置 | 只保存主站视频模型 ID、展示覆盖、能力覆盖、默认参数、启用状态和排序。 |
| URL 校验 | 用户素材 URL 拒绝本机、内网、凭据片段和非 http/https 协议；平台上传素材允许主站受控路径。 |
| 删除保护 | 模型已有任务、计费、策略或模板引用时应停用而不是删除。 |

## 配置流程

1. 在主站 AI Provider 中配置并启用视频模型。
2. 在 Console `/models` 为主站视频模型配置用户可见性、默认参数、能力覆盖、模型级计费和排序。
3. 在 `/config` 选择提示词优化 LLM。
4. 在 `/policies` 配置 prompt、素材、并发、用户/IP/provider/model 等风控策略。
5. 使用 `/history` 和任务详情复核提交、失败退款、通知和状态时间线。

## 开发与验证

```bash
pnpm --filter echoflow-video check-types
pnpm --filter echoflow-video build:api
pnpm --filter echoflow-video build:web
pnpm --filter echoflow-video test
pnpm --filter echoflow-video test:e2e # 需要 ADMIN_AUTH_TOKEN / WEB_USER_AUTH_TOKEN
pnpm --filter echoflow-video build:publish
```

验证证据：

| 范围 | 证据状态 | 命令/场景 | 环境基线 | 结论 | 后续条件 |
|---|---|---|---|---|---|
| 类型、构建与边界测试 | historical | README 记录的 package scripts | 既有本地验证记录 | 曾按上述命令验证；测试桩需随主系统 SDK 导出同步。 | 交付前用当前 Node 22.20 / pnpm 10.20.0 重新执行最小验证矩阵。 |
| Web public 边界 | current | `tests/video-public-api-boundary.test.mjs` | 静态测试约束 | 约束 Web/Console 字段分离、RootLayout、SDK 限流、provider HTTP、public serializer 和常驻路径依赖。 | Web/API serializer、RootLayout 或 SDK 边界变更后重新执行。 |
| 发布包边界 | current | `tests/video-manifest-boundary.test.mjs` | 静态测试约束 | 约束 manifest/package/registry、发布 allowlist、静态资产和运行时目录排除。 | metadata、release allowlist 或发布脚本变更后重新执行。 |
| 真实端到端 | pending | 真实主站视频模型、余额和存储 | 需要真实环境 | 未覆盖提交、失败退款、转存和通知闭环。 | 准备真实主站视频模型、余额、存储和测试素材后执行。 |
| 主系统安装 | pending | release zip 安装 smoke | 需要主系统安装/迁移/重启 | release zip 内容检查不等于安装完成。 | 只有在主系统成功安装、迁移、重启并打开 Web/Console 后才能声明通过。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实供应商未 smoke | 当前不能声明完整生产闭环。 | 准备主站视频模型、余额、存储和测试素材后逐模型验证。 |
| 短视频制作 reserved | 页面存在但不是上线能力。 | 保持 reserved 文案和禁用路径，明确业务边界后再转正式功能。 |
| 真实上传边界 | 单测覆盖平台上传记录校验，仍需真实上传链路验证。 | 覆盖上传记录创建、归属、存储读取、历史素材重传和删除后提交。 |

## 下一步

后续开发按“真实链路优先、发布可安装、再做体验细节”的顺序推进。每个阶段完成后把新证据更新到本 README；若发现跨插件通用规范，再同步更新根目录 `AGENTS.md`。

| 任务 | 范围 | 验收 |
|---|---|---|
| P1 真实端到端 smoke | 主站视频模型、测试用户、余额、存储、Web 工作台 | 覆盖文生视频、图生/多参考图、可控失败退款、结果转存和成功/失败通知；记录脱敏任务 ID、账务事实和通知记录。 |
| P1 发布包安装 smoke | `build:publish`、`extension:release`、主系统安装路径 | release zip 内容符合白名单；真实安装后 migration/upgrade 执行、服务重启、Web/Console 页面可打开。 |
| P2 真实上传与 provider URL smoke | 平台上传、素材校验、provider 结果 URL | 覆盖上传记录创建、归属、存储读取、历史素材重传、删除后提交、公网/跳转/凭据 URL 边界。 |
| P2 体验与体积复核 | Web build 输出、桌面和 390px 移动端 | 主入口体积和 CSS 继续收敛；无横向溢出、文本遮挡、console error/warn。 |
| P3 短视频制作转正式前置 | Web/Console `studio`、数据/队列/计费设计 | 明确素材编排、分镜、批量生成、剪辑导出或模板化发布边界后再转正式能力。 |
