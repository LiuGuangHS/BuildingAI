# AI 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的星盘与运势报告插件。插件基于出生信息、星座生肖、长期档案和用户问题生成每日运势、性格洞察、情感配对、事业财富与生活决策建议；报告生成走主站 LLM，按报告类型计费，并提供失败退款保护。

文档维护规则：全仓公共边界、主系统二开、上游同步、组件化 UI 和验证规则维护在根目录 `AGENTS.md`；本 README 只维护 `echoflow-astrology-fortune` 的业务边界、能力状态、入口、报告/队列/计费/生成上下文事实、验证命令和待办。临时分析、浏览器 QA checklist、设计参考、外部项目快照或计划文档只作为施工材料，有效结论必须合并到 `AGENTS.md` 或本 README，不长期维护第二套插件规范；新的报告结构、追问、反馈、计费、队列、浏览器 QA 或 AI 可信度结论也同样先回写这两处长期入口，并从“下一步”移除已经落地的旧计划。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 主系统内嵌的付费模型解读业务面板，不是普通星座小工具，也不是独立完整应用。 |
| 用户端 | 紧凑多 Tab 业务面板：每日、问问、配对、档案、报告；只展示生成所需上下文和结果操作。 |
| Console | 概览、模型与价格、报告记录、任务与退款、用户档案。 |
| 文案 | 用户端讲分析范围、扣费和退款；Console 保留模型/AI 运维术语。 |
| 视觉 | 作为主系统 iframe 内的插件面板，回归主系统 Card、Tabs、Button、Dialog，不使用整页星空、玻璃拟态、大面积 AI Hero 或独立 App 外壳；桌面两列工作区按内容顶部对齐，输入面板不为了追平右侧报告而拉伸成整页高度。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 用户档案 | ready | 保存出生信息、星座生肖、长期档案和上下文。 |
| 报告生成 | ready | 按报告类型创建异步任务，成功写结构化结果、判断依据、摘要、完整文本、通知摘要和模型快照。 |
| 生成状态 | ready | Web 公开 `/astrology-fortune/generation-status`，只返回 `canGenerate`、`unavailableReason` 和公开价格组；无可用 LLM 或配置暂停时，今日、问问、关系、模板、参数和重新生成入口统一禁用，不泄漏模型 ID、Provider、Secret、Base URL 或 Console 排障字段。 |
| 生成上下文 | ready | Web 公开 `generationContext`，记录报告类型、关注方向、当前状态、问题、语言、是否包含目标对象和脱敏问题质量；后端同步计算问题质量上下文并进入 request payload / prompt；用户端问题质量面板会解释已包含信息、建议补充项和对 AI 输出的影响；不暴露原始目标对象、模型、Provider 或请求载荷。 |
| AI 结果契约 | ready | 模型输出必须是结构化 JSON，并通过后端 schema 校验；`evidence` 来源只能来自用户档案、当前状态、问题质量、目标对象、追问来源或用户反馈，每条都必须给出 `confidence` 的 low/medium/high 等级，后端不补默认置信度；即使包含白名单词也会拒绝“未提供、缺失、未知、猜测、推测、虚构、编造”等不可用上下文；标题、摘要、依据、段落、行动、风险、复盘、追问和结尾不能使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺；`actions` 与 `warnings` 必须能回到本次 `evidence` 的 source/insight，避免漂亮但脱离依据的泛化建议；首次输出为空、非 JSON 或结构异常时只做一次格式修复重试，仍不放宽 schema，第二次仍失败才进入格式异常失败和账务事实退款；修复成功会在报告 metadata 记录 `aiRepairAttempted`、`aiRepairSucceeded` 和脱敏 `aiRepairReason`，供 Console/后续 smoke 观察模型输出质量。 |
| 报告类型 | ready | 支持每日运势、性格洞察、情感配对、事业财富和问题解读等类型。 |
| AI 复盘清单 | ready | 报告结果必须包含 `reviewChecklist`，把判断依据、行动建议和风险提醒转成可观察、可勾选、可导出的复盘项；用户端、Console 详情、复制/下载和成功通知摘要都保留该结构，让 AI 判断能被后续验证。 |
| 继续追问 | ready | 不新增聊天实体，追问会回到“问问”工作区复用报告生成入口；报告结果可返回 `followUps`，用户端优先展示模型生成的追问建议，并在问问区显示“基于上一份报告继续”的来源提示和清除上下文入口；来源报告摘要、带 low/medium/high 置信度的判断依据、行动项、风险提醒、复盘清单和脱敏反馈作为白名单上下文进入队列 payload 与 AI prompt；追问 prompt 明确要求 high 置信依据可延续判断、medium 需要补观察、low 只能作为待验证线索。 |
| 质量反馈 | ready | 用户端反馈面板支持评分和一条短备注，轻量写入报告 metadata，字段受限、可回显、可审计；继续追问时会把来源报告的评分和备注摘要带入 prompt，形成质量反哺。 |
| 多页面 Console | ready | `consoleRoutes` 拆为概览、模型与价格、报告、任务退款和档案。 |
| 计费退款 | ready | 使用主系统算力账本，报告失败按账务事实退款。 |
| 队列报告 | ready | 报告生成接入主系统 `QueueModule` / BullMQ，不保留进程内 fallback；入队失败、Worker 崩溃和超时回收都会写失败态并记录 `failureType/failureReason`，便于 Console 排查。 |
| 终态保护 | ready | Worker 崩溃、超时回收和异常失败写回逐条加锁，只允许 `PENDING/PROCESSING` 报告进入失败态，并保留失败归因 metadata。 |
| 真实 Redis/Worker smoke | pending | 仍需覆盖成功、失败、超时、删除保护和退款异常。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-astrology-fortune/` | `src/web/pages/index.tsx` | 用户档案、报告生成、历史、结果、反馈和继续追问。 |
| Console | `/console/` | `src/web/pages/console.tsx` section=`overview` | 运营概览。 |
| Console | `/console/settings` | `src/web/pages/console.tsx` section=`settings` | 模型与价格。 |
| Console | `/console/reports` | `src/web/pages/console.tsx` section=`reports` | 报告记录。 |
| Console | `/console/tasks` | `src/web/pages/console.tsx` section=`tasks` | 超时任务、失败和退款排查。 |
| Console | `/console/profiles` | `src/web/pages/console.tsx` section=`profiles` | 用户档案运营。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册，Console 使用 `consoleRoutes` + `consoleMenus`。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web | `@ExtensionWebController("astrology-fortune")` | 档案、报告生成、报告历史、反馈和继续追问。 |
| Console | `@ExtensionConsoleController("astrology-fortune", "AI星盘运势管理")` | 模型价格、报告、任务退款、档案和统计；报告详情展示 AI 判断依据、复盘清单、失败类型、失败原因和退款异常，不展示原始请求、上游响应或 Secret。 |

关键模块：

| 模块 | 说明 |
|---|---|
| `astrology-fortune.module.ts` | 导入主站 AI、计费和队列能力，注册报告服务。 |
| `astrology-fortune.service.ts` | 档案、报告任务、LLM 调用、结构化结果、扣费退款、超时回收和删除保护。 |
| `astrology-question-quality.ts` | 计算问题质量、缺失信息和 prompt 摘要，让前端的问题质量提示真正进入后端生成链路。 |
| `astrology-report-public-metadata.ts` | 构造用户端可展示的公开生成上下文，避免前端从 `tags` 或私有 metadata 猜测分析依据。 |
| `dto/astrology-fortune.dto.ts` | 用户端和管理端请求/响应约束。 |
| `src/web/constants/report-types.ts` | 用户端报告类型、展示文案和分析范围。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| LLM | 通过 `AiPublicModule` / `PublicAiModelService` 获取启用 LLM 并调用 `generateText()`；星盘业务层不直接读取 Provider adapter 或 Secret。 |
| Provider Config | 由 `PublicAiModelService` 在主系统边界内复用 Provider/Secret 归一化；插件只保存主站模型 ID，不重复拉取或归一化 Provider 配置。 |
| AI 结果解析 | 报告 AI 结果解析使用主系统 `@buildingai/extension-sdk/utils/pure` 的 `safeJsonParse` 读取模型返回 JSON，公开上下文使用同入口 `buildDefinedWhere`；纯解析路径不从 SDK 根入口拉起 Nest/DB/低层 AI provider。schema、结构化默认值和非法 JSON 错误仍由报告解析 service 与 focused tests 兜底。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款。 |
| Queue | 报告生成使用主系统 `QueueModule` / BullMQ；队列不可用、Worker 崩溃或超时回收时先按账务事实退款，再标记报告失败并返回可观测错误，metadata 保留 `failureType` 和 `failureReason`。 |
| Rate Limit | Web 报告生成入口复用 `ExtensionRateLimitService` + 主系统 Redis 做 10 秒/分钟双窗口限流；价格组和报告扣费只负责业务资格与成本控制。 |
| Notification | 通过 `ExtensionNotificationService` 注册报告生成成功和报告生成失败场景；成功通知携带精简 AI 摘要、评分、关键词、幸运锚点、前两条带 low/medium/high 置信度的判断依据、复盘清单和追问建议，缺少置信度或来源/洞察不完整的依据不会进入通知摘要；失败通知携带退款排查信息；通知投递失败不影响报告终态。 |
| 构建依赖 | 已清理模板残留依赖；依赖保留以源码、`vite`、`tsconfig` 或测试配置链路里真实用到为准。 |
| UI | 用户端和 Console 复用主系统 Tabs、Card、Button、Dialog、Label、Checkbox、表单组件、Alert、Skeleton 和局部空状态；复盘清单和行动项这类复合勾选行使用系统 `Label` + `Checkbox` + `useId()` 保留整行点击语义并避免重复 DOM id；插件 CSS 只控制布局、业务分组、报告展示状态和响应式。 |
| RootLayout / React Query | `src/web/main.tsx` 只挂主系统扩展 `RootLayout`，不再自建 `QueryClientProvider`；页面和 service hooks 复用 RootLayout 提供的查询上下文。 |
| 路由分包 | Web 首页和 Console 管理页均通过 React lazy 加载，路由 fallback 使用主系统 `Skeleton`；Console 代码不静态进入用户端路由模块。 |
| 数据 | 轻量反馈先写入业务记录 metadata；若需要全量运营统计，再迁移为独立实体。 |

依赖边界：用户端页面直接 import `sonner` 的 `toast`，因此插件 `package.json` 显式声明 `sonner`；不要依赖视频或图片插件的同名依赖偶然存在。

## 用户体验规则

| 主题 | 要求 |
|---|---|
| 付费说明 | 每个生成入口展示分析范围、价格组或扣费规则、失败/退款保护。 |
| 插件边界 | 用户端不重复主系统已有的账号、头像、全局导航、应用标题、余额入口和全局统计；只展示当前业务需要的档案、生成依据、报告状态和结果动作。 |
| 首屏 | 优先展示当前档案、当前问题、生成按钮和最近结果，不把模型机制放到主视觉层级，不做营销落地页。 |
| 尺寸 | 页面适配主系统可用内容区，避免固定整页大壳、过宽居中容器和 `100vh` 背景造成与主系统割裂。 |
| Tab | `今日`、`问问`、`关系`、`档案`、`报告` 是插件内部业务切换，不承担主系统级导航职责。 |
| 继续追问 | 将追问问题带回 `问问` 工作区，复用 `/astrology-fortune/reports/generate`；问问区必须显示来源报告提示和“清除上下文”，让用户知道这次生成会带着上一份报告继续。 |
| 结果区 | 展示行动项、摘要、参考来源和质量反馈；AI 摘要使用系统 `Alert`，状态、关键词、生成依据和幸运锚点使用系统 `Badge`，主分数使用系统 `Progress`，反馈区使用系统 `Textarea` 收集短备注，明确提示这条备注会进入下一次追问或同类报告的 AI 质量参考。 |
| 查询失败 | 非关键列表、档案和历史使用局部空状态或重试提示，不用全局 toast 淹没工作区。 |
| Console | 只做配置、任务、退款、报告和档案运营，不混入用户生成流程。 |

## 用户端设计收敛

首轮前端优化按“嵌入式业务面板”落地，优先级如下：

| 优先级 | 内容 | 说明 |
|---|---|---|
| P1 | 紧凑业务工具栏 | 保留内部 Tab、当前档案、档案完整度、价格组和失败退款；移除插件级 App Header、报告总数、收藏总数等全局感信息。 |
| P1 | 问问生成器 | 左侧输入报告类型、关注方向、当前状态和具体问题；问题质量面板展示可用度、已包含、建议补充和输出影响；右侧展示本次参考和报告预览。 |
| P1 | 今日面板 | 关注领域、今日状态、模板问题和最近今日报告摘要。 |
| P1 | 关系面板 | 对方信息、关系场景、信息可信度、分析范围和关系报告预览。 |
| P1 | 报告消费 | 摘要优先，其次紧凑 AI 锚点、判断依据、AI 复盘清单、行动项、风险提醒、观察信号、生成依据、问题质量、模型生成追问建议和反馈；工作台 compact 报告卡展示整体评分、幸运锚点和前三条判断依据，让高/中/低置信层级优先可见，不把核心结论只藏在详情弹窗。 |
| P1 | 生成依据链路 | 用户端历史、报告卡和详情优先读取后端公开 `generationContext`，展示范围、状态、问题和追问来源。 |
| P1 | 档案质量提示 | 档案列表和工具栏展示 AI 依据完整度、缺项和当前价格组，提醒用户补全出生信息会提升报告颗粒度。 |
| P2 | 报告导出/分享 | 用户端已提供复制和 `.txt` 下载；导出优先从结构化 `result` 重建文本，保留评分、关键词、幸运锚点、判断依据、复盘清单、行动项、风险提醒和模型生成追问，避免旧 `resultText` 丢失 AI 亮点。PDF、对比报告和资产库后置。 |

暂不做插件级用户中心、独立首页 Hero、全局数据看板、复杂分享中心和完整报告资产库；这些容易和主系统能力重复，或把插件做成独立应用。

### 2026-06-20 设计审查结论

| 审查项 | 结论 |
|---|---|
| 插件边界 | 用户端继续作为主系统 iframe 内的业务面板，不重复账号、头像、全局导航、余额入口或完整应用壳。 |
| AI 亮点 | 智能感落在问题质量、AI 解读范围、生成依据、档案完整度、行动建议、风险提醒、继续追问和反馈闭环；问题质量不只显示分数，还要说明已包含上下文、建议补充项和为什么会影响判断依据、行动建议和复盘清单；继续追问不只是填入新问题，还要把上一份报告的带置信度判断依据、行动、风险、复盘和反馈作为白名单上下文带入下一轮 AI；反馈闭环不只记录评分，还要允许用户补一句真实纠偏或有效点，进入后续 AI 质量参考。 |
| 视觉密度 | 桌面端采用左侧输入/任务、右侧报告/准备度；多列区块使用顶部对齐，生成表单和任务面板保持内容高度，避免主系统 iframe 内出现大面积空白；移动端收敛为单列，内部 Tab 横向滚动。 |
| 数据链路 | 报告卡、历史和详情优先读取 Web 公开 `generationContext`，包括脱敏问题质量；不从私有 request payload 或未脱敏 metadata 推断上下文。 |
| 公开上下文 | `generationContext` 只保留报告类型、关注方向、当前状态、问题、语言、是否有目标对象和问题质量摘要；通知摘要只保留评分、关键词、幸运锚点、带置信度的判断依据、复盘清单和追问建议的公开片段，不透出原始请求、Provider 或 Secret，也不把缺失置信度的依据包装成可信结论。 |
| 公开类型 | Web `AstrologyReport` / `AstrologyProfile` 不包含 `userId`、`modelId`、`providerId`、`requestPayload`；Console 通过 `ConsoleAstrologyReport` / `ConsoleAstrologyProfile` 单独扩展排障字段。Web 查询参数不包含用户/模型/Provider 筛选，Console 使用 `ConsoleQueryAstrologyReportsParams` / `ConsoleQueryAstrologyProfilesParams`。 |
| 首屏预期 | 空报告状态也要预告摘要、判断依据、复盘清单、行动建议、观察信号和继续追问，让用户生成前就理解 AI 输出是可解释、可执行、可复盘的结构。 |
| 视觉约束 | 复用主系统 token、Button、Tabs、Dialog 和表单组件；插件 CSS 只控制布局、业务分组、状态和响应式；普通工作区通过 Tailwind `items-start` / `self-start` 控制嵌入式面板高度，不使用 `self-stretch` 把插件撑成完整应用壳。 |
| 样式边界 | 用户端主要视觉落在系统组件 `className`、Tailwind 工具类和 `cn()` 组合；普通 Tab、面板、空态、进度和报告卡不得再注入内联 `<style>` 或长期维护手写 CSS，确需特殊媒体/画布样式时要有测试或 README 说明。 |
| 时间展示 | 用户端报告列表、生成依据和详情使用本插件本地 `formatReportTime()`，不依赖额外 i18n provider，避免成功报告态在扩展 RootLayout、preview 或 mock smoke 中崩溃。 |
| 结构化展示 | 用户端行动建议和风险提醒同时兼容历史字符串与模型结构化对象；新报告的 `actions` 使用 `{ item, reason, timebox }`，`warnings` 使用 `{ title, detail }`，主报告卡把行动拆成“事项/原因/时间”、风险拆成“标题/detail”，导出和通知摘要继续通过 `formatActionItem()` / `formatWarningItem()` 串联，不能把对象直接作为 React child 或复制文本输出 `[object Object]`。 |
| AI 契约 | AI 结果解析、标题 title、摘要 summary、评分 scores、关键词 keywords、幸运锚点 lucky、判断依据 evidence、洞察段落 sections、行动建议 actions、风险提醒 warnings、复盘清单 reviewChecklist、模型生成追问 followUps、结构化默认值、问题质量上下文、追问来源上下文、反馈反哺和用户反馈 metadata 由独立 service 与 focused tests 兜底；`title` 与 `summary` 必须非空，`scores` 必须由模型明确给出且至少包含 `overall`，不在后端或前端补默认分，`keywords` 至少 2 个非空词，`lucky` 必须包含 `color`、`number`、`direction` 和 `timeRange`，不让用户端固定展示位退化为空标签或占位符，`evidence`、`reviewChecklist` 和 `followUps` 至少各 2 条，`sections` 至少 4 段且必须覆盖洞察、机会、风险和行动，`actions` 至少 3 条且每项必须包含非空 `item`、`reason`、`timebox`，`warnings` 至少 2 条且每项必须包含非空 `title`、`detail`；`evidence.source` 只允许来自用户档案、出生/星座信息、长期画像、当前状态、当前问题、问题质量、目标对象、关系状态、追问来源、来源报告或用户反馈等真实上下文；复盘清单的 `evidenceSource` 必须能追溯到本次报告的判断依据、行动建议或风险提醒，`followUps` 必须是可执行问题或延展请求，缺失、编造来源、不可追溯或口号式追问都会进入格式异常失败与账务事实退款链路；解析器兼容 `text`、`outputText`、`output_text` 和 `choices[0].message.content` 等常见 SDK 文本形态，避免真实模型返回成功但插件误判失败。 |
| 生成可用性 | Web 用户端以公开 generation-status 为唯一生成能力来源；`canGenerate=false` 时保留业务工作台、档案和历史，但禁用生成输入、模板、关系参数、提交和重新生成，并用主系统主题提示当前生成服务不可用。 |
| 失败体验 | 模型返回空内容、非 JSON 或结构不符合契约时，用户端只看到“AI 返回格式异常、按账务事实退款”的安全文案；业务 metadata 保留 `failureType` 和 `failureReason` 供 Console 排查，不暴露原始模型输出。 |
| Console 诊断 | 管理端报告详情复用 Dialog、Badge 和 Detail 小块展示 AI 评分、关键词、幸运锚点、判断依据、复盘清单、行动建议、风险提醒、继续追问、AI 修复重试、修复结果、修复原因、失败类型、失败原因和退款异常；排障只读取公开结构化结果和脱敏 metadata，不读取 `requestPayload`、原始上游响应或 Secret。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 档案、报告、配置和任务记录使用插件实体。 |
| Migration | 首版表结构位于 `src/api/db/migrations/`，migration 产物需进入发布包。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等写入主系统 extension 安装记录。 |
| 报告状态 | 报告包含 `PENDING`、`PROCESSING`、成功、失败、退款等状态，处理中禁止删除。 |
| 软删除 | 退款补偿可用 `withDeleted: true` 查询历史异常报告。 |
| 结果 | 保存结构化结果、判断依据、AI 复盘清单、模型生成追问建议、完整复制文本、摘要、模型快照和有限 metadata，不保存密钥或未脱敏上游响应；用户端复制/下载以结构化结果重建文本为优先，兼容历史 `resultText`。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 报告入库后以报告 ID 作为 `associationNo` 幂等预扣。
- 模型调用失败时报告标记为 `failed` 并按账务事实自动退款。
- 退款失败写入 `providerMetadata.refundError`，便于任务退款页排查。
- 即使报告已软删除，补偿和退款错误记录仍可读取历史记录处理。

## 开发与验证

```bash
pnpm --filter echoflow-astrology-fortune check-types
pnpm --filter echoflow-astrology-fortune test
pnpm --filter echoflow-astrology-fortune build:api
pnpm --filter echoflow-astrology-fortune build:web
pnpm --filter echoflow-astrology-fortune build:publish
pnpm --filter echoflow-astrology-fortune smoke:web
```

`build:web` 使用 `vite.config.mjs` 和 `--configLoader native`。若 Vite/Rolldown 在配置加载或 HTML entry 解析阶段失败，先用最小 HTML smoke 区分工具链问题与插件业务代码问题。

`build:publish` 直接串联 `rimraf`、`vite build` 和 `tsup`，不在脚本内部再次调用 `pnpm run`，避免 Windows/Corepack 环境下嵌套 pnpm 命中错误 shim 或版本守卫。

`smoke:web` 是真实主站 Web API smoke，默认只验证公开 generation-status、档案创建/复用和公开报告列表边界；设置 `ASTROLOGY_SMOKE_GENERATE=1` 后才会真实提交报告、轮询终态、校验结构化 AI 结果、每条判断依据的 `confidence`、提交反馈并验证继续追问来源。公开报告必须过滤用户、模型、Provider、Secret、原始 payload、Base URL 和 AI 修复审计字段；修复重试诊断只允许 Console 排障查看。必需环境变量：

| 变量 | 说明 |
|---|---|
| `ASTROLOGY_SMOKE_TOKEN` 或 `BUILDINGAI_ACCESS_TOKEN` | 登录后访问 Web API 的 Bearer token；缺失时脚本必须失败，不能假通过。 |
| `ASTROLOGY_SMOKE_BASE_URL` 或 `BUILDINGAI_BASE_URL` | 主站地址，默认 `http://127.0.0.1:4090`。 |
| `ASTROLOGY_SMOKE_GENERATE=1` | 开启真实生成、轮询、反馈和继续追问验证；未设置时只做非扣费边界 smoke。 |
| `ASTROLOGY_SMOKE_TIMEOUT_MS` / `ASTROLOGY_SMOKE_POLL_INTERVAL_MS` | 真实生成轮询超时和间隔。 |

当前验证缺口：

| 项目 | 状态 |
|---|---|
| 单测 | 已覆盖 AI SDK 边界、AI 输出契约、常见 SDK 文本返回形态、模型输出异常失败归一化、标题/摘要非空、评分 scores 必填且包含 overall、关键词 keywords 与幸运锚点 lucky 必填非空、判断依据 evidence、判断依据来源白名单、洞察段落 sections 的洞察/机会/风险/行动覆盖、结构化行动建议 actions `{ item, reason, timebox }`、结构化风险提醒 warnings `{ title, detail }`、AI 复盘清单 reviewChecklist 和模型生成追问 followUps 的必填/非空下限、复盘清单依据可追溯性、继续追问可执行性、继续追问来源在问问区可见并可清除、继续追问 prompt 带入上一份报告的带置信度判断依据、行动/风险/复盘和脱敏反馈，并约束 high/medium/low 置信度在追问里的使用方式、复制/下载/成功通知保留评分、关键词、幸运锚点、带置信度 AI 依据、复盘清单与追问，用户端、Console 和复制/下载统一使用“高/中/低置信”标签，compact 报告卡展示前三条判断依据以保留完整置信层级，通知摘要过滤 raw provider 字段且不会把缺置信度的依据发给用户、问题质量上下文、问题质量面板的已包含/建议补充/输出影响说明、公开生成依据中的脱敏问题质量、追问来源上下文入队与 prompt、反馈反哺、反馈 metadata、用户端反馈短备注进入提交 payload、报告时间不依赖额外 i18n provider、结构化行动/风险对象安全渲染与导出、Web/Console public 类型边界、公开生成状态和不可用禁用入口、用户端 compact 报告卡 AI 锚点、Console 详情失败归因与 AI 评分/关键词/幸运锚点/依据/复盘清单/行动建议/风险提醒/继续追问展示、用户端样式边界、嵌入式工作区不使用 `self-stretch` 拉伸输入面板、路由分包、RootLayout 查询上下文边界、构建产物入口 smoke、Web API smoke 脚本公开路径/标准响应壳/Token 必填/真实生成 opt-in 边界、通知规则、报告回收规则、公开生成上下文、扣费幂等、失败退款顺序，以及队列入队失败、Worker 崩溃和超时回收归因边界；仍需补真实模型联调和账务数据库集成测试。 |
| Redis/Worker | 需要真实 smoke 成功、失败、超时、删除保护和多实例恢复。 |
| 真实 LLM | 需要主站真实模型、Secret、余额和测试档案覆盖报告生成与失败退款。 |
| Web 构建 | 已在 Node 22 / pnpm 10 环境通过 `build:web`；Web 首页和 Console 管理页通过 lazy route 独立拆包，Vite preview HTTP smoke 可访问 HTML、JS 和 CSS 产物。 |
| 浏览器 QA | 2026-06-20 先发现 `http://localhost:5173/extension/echoflow-astrology-fortune` 实际由视频插件 dev server 提供，Vite 提示 base URL 为 `/extension/echoflow-video`；星盘前端应使用本插件 dev server 输出的实际端口访问，例如本轮 Vite 输出 `http://localhost:5177/extension/echoflow-astrology-fortune`。本轮 in-app browser 验证空态可打开，无 error boundary、无横向溢出、无 `[object Object]`；多列今日工作区左侧输入面板不再被右侧报告撑成等高整页卡。Playwright/Edge 以主系统标准响应壳 `code: 20000` mock `localhost:4090` 的档案、公开 generation-status 和报告接口后，1366x900 与 390x844 报告态均可见 AI 摘要 `Alert`、分数 `Progress`、状态/关键词/依据 `Badge`、“高/中/低置信”三档判断依据、结构化行动 `reason/timebox`、风险 `detail`、AI 复盘清单、继续追问和反馈入口；无 React page error，未出现页面横向滚动。mock 环境中未拦截的主站资源可能产生 `ERR_CONNECTION_RESET/EMPTY_RESPONSE` 资源日志，不作为插件渲染错误。 |
| 当前 CLI 复验 | 2026-06-20 本轮 `pnpm --filter echoflow-astrology-fortune test` 共 94 项全通过；聚焦 `astrology-report-ai-result.test.mjs` 已覆盖每条判断依据必须由模型给出 low/medium/high 置信度、不可用/猜测来源即使包含白名单词也会被拒绝，且用户可见 AI 报告内容不能使用确定性承诺；`astrology-prompt-boundary.test.mjs` 已覆盖主生成 prompt 明确要求 `confidence` 只能是 low/medium/high，并覆盖主生成 prompt 与格式修复 prompt 都明确禁止确定性承诺；`astrology-web-report-actions.test.mjs` 已覆盖复制/下载文本从结构化结果重建、保留“高/中/低置信”标签，并要求 compact 报告卡展示前三条判断依据；`astrology-web-style-boundary.test.mjs` 已覆盖嵌入式工作区不用 `self-stretch` 把输入面板拉成完整应用壳；`astrology-web-smoke-script.test.mjs` 已覆盖 Web smoke 对 AI 修复审计字段的公开 API 过滤断言，并要求真实生成 smoke 逐条校验 `evidence.source`、`evidence.insight` 和 `evidence.confidence`。`check-types`、`build:api`、`build:web` 和 `build:publish` 均通过；`smoke:web` 在未提供 token 时按设计失败并提示需要 `ASTROLOGY_SMOKE_TOKEN` 或 `BUILDINGAI_ACCESS_TOKEN`。本轮同时重建了 `@buildingai/extension-sdk` dist，确认 `utils/pure`、`provider-config` 等公开导出产物存在；星盘后端纯解析服务从 `@buildingai/extension-sdk/utils/pure` 导入 `safeJsonParse` / `buildDefinedWhere`，避免为了 JSON/where helper 拉起 SDK 根入口的 Nest/DB/低层 AI provider。Web 用户端主入口约 910 KB，Console 管理页独立 chunk 约 47 KB，仍有 Vite chunk warning；`build:publish` 已改为直接串联底层 CLI，避免嵌套 pnpm 触发 Windows/Corepack 版本守卫。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 队列拓扑未 smoke | 不能声明多实例、重启恢复和超时补偿生产闭环。 | 覆盖 Redis/Worker 成功、失败、超时和删除保护。 |
| 真实模型未联调 | 报告质量、结构化输出和失败退款仍需正式验证。 | 准备主站模型、Secret、余额和档案样本。 |
| 反馈仍在 metadata | 适合轻量回显，不适合大规模运营统计。 | 需要运营统计时迁移为独立反馈实体。 |
| 星盘内容合规 | 建议可能被用户误解为确定性承诺。 | 文案持续强调分析建议、参考范围和退款保护。 |
| Web 主入口偏大 | Console 已从用户端入口拆出，但用户端主入口仍超过 500 KB，影响首屏加载和后续可维护性。 | 后续继续拆报告详情、历史列表或低频面板重组件，复验 chunk warning。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实端到端 smoke | Web 报告工作台、报告 service、主站模型/Secret/余额 | 使用 `pnpm --filter echoflow-astrology-fortune smoke:web` 做用户端公开 API smoke；默认只验证登录、状态、档案和历史列表，设置 `ASTROLOGY_SMOKE_GENERATE=1` 后才进入真实生成、计费、队列、反馈和继续追问。 | 必须提供 `ASTROLOGY_SMOKE_TOKEN` 或 `BUILDINGAI_ACCESS_TOKEN`，并记录脱敏报告 ID、账务事实、反馈 metadata、追问上下文和失败退款事实；未配置真实模型/Secret/余额/Redis Worker 时不声明通过。 |
| P1 Redis/Worker smoke | BullMQ processor、超时回收、删除保护 | 覆盖成功、失败、超时回收、软删除保护、退款异常和服务重启恢复。 | 不重复扣费、不重复通知；Console 任务页能看到失败类型和退款异常。 |
| P1 真实模型与账务测试 | `tests/*`、Console 任务页、计费 service | 补真实模型联调脚本、账务数据库集成测试和 Console 任务页 focused tests。 | 测试能证明扣费幂等、失败退款顺序和脱敏排障字段；Web 不暴露模型/Provider/Secret。 |
| P2 反馈实体化评估 | 报告 metadata、可选反馈实体、Console 统计 | 按正式运营需求决定是否把反馈 metadata 迁移为独立实体。 | 没有大规模统计需求时继续 metadata；若迁移，提供 migration、serializer 和 Console 查询边界。 |
| P2 用户端文案继续收敛 | Web 页面、报告卡、详情、模板问题 | 继续压缩用户端技术词，保持智能感来自分析结构、行动项和上下文来源。 | 用户端不出现 Provider、模型 ID、原始 payload；无可用模型时输入与提交保持禁用。 |
