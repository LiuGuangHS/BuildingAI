# 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的星盘运势插件。用户输入出生信息后生成个人星盘、运势解读与提问建议；报告生成走主站 LLM，按报告类型计费，并提供失败退款保护。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

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
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复（recoverInterruptedReports + failStaleReports），事务内悲观锁（`pessimistic_write`）+ CAS 二次校验（`canRecoverAstrologyReport`/`canClaimAstrologyReportForProcessing`）防止多实例重复入队。 |
| 统计聚合 | ready | Console 概览统计使用 CASE WHEN 单 SQL 聚合（success/failed/pending/processing/favorite），消除 N+1 COUNT 查询。 |
| 真实 Redis/Worker smoke | pending | 仍需覆盖成功、失败、超时、删除保护和退款异常。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-astrology-fortune/*`；extension bundle / local dev base 是 `/extension/echoflow-astrology-fortune/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-astrology-fortune/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-astrology-fortune/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-astrology-fortune/` | `src/web/pages/index.tsx` | 用户档案、报告生成、历史、结果、反馈和继续追问。 |
| Console route | `/console/` | `src/web/pages/console.tsx` section=`overview` | 运营概览。 |
| Console route | `/console/settings` | `src/web/pages/console.tsx` section=`settings` | 模型与价格。 |
| Console route | `/console/reports` | `src/web/pages/console.tsx` section=`reports` | 报告记录。 |
| Console route | `/console/tasks` | `src/web/pages/console.tsx` section=`tasks` | 超时任务、失败和退款排查。 |
| Console route | `/console/profiles` | `src/web/pages/console.tsx` section=`profiles` | 用户档案运营。 |

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

## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| 生成可用性 | Web 以公开 `generation-status` 作为唯一生成能力来源，只返回 `canGenerate`、`unavailableReason` 和公开价格组。 |
| 生成上下文 | Web 公开 `generationContext`，包含报告类型、关注方向、当前状态、问题、语言、目标对象存在性和脱敏问题质量。 |
| AI 契约 | 模型结果必须是结构化 JSON；标题、摘要、评分、关键词、幸运锚点、判断依据、洞察段落、行动、风险、复盘清单和追问都有最小可用要求。 |
| 置信与来源 | `evidence` 来源只能来自真实上下文，且每条必须由模型给出 low/medium/high；不可用、猜测或编造来源进入格式异常失败。 |
| 继续追问 | 不新增聊天实体，追问回到“问问”工作区并带入来源报告摘要、置信依据、行动、风险、复盘和脱敏反馈。 |
| 反馈 | 用户端反馈只支持评分和短备注，轻量写入 metadata，并作为后续追问/同类报告的质量参考。 |
| 队列与退款 | 报告生成走主系统队列；入队失败、Worker 崩溃和超时回收会写失败归因并按账务事实退款。 |
| Public 边界 | Web 不返回用户 ID、模型 ID、Provider、Secret、原始 payload、Base URL、AI 修复审计或 Console 排障字段。 |

依赖边界：用户端页面直接 import `sonner` 的 `toast`，因此插件 `package.json` 显式声明 `sonner`；不要依赖视频或图片插件的同名依赖偶然存在。

## 用户端边界

| 主题 | 要求 |
|---|---|
| 插件边界 | 用户端继续作为主系统 iframe 内的业务面板，不重复账号、头像、全局导航、余额入口或完整应用壳。 |
| 首屏 | 优先展示当前档案、当前问题、生成按钮和最近结果，不把模型机制放到主视觉层级，不做营销落地页。 |
| Tab | `今日`、`问问`、`关系`、`档案`、`报告` 是插件内部业务切换，不承担主系统级导航职责。 |
| 继续追问 | 将追问问题带回 `问问` 工作区，复用 `/astrology-fortune/reports/generate`；问问区必须显示来源报告提示和“清除上下文”。 |
| 结果区 | 摘要、判断依据、行动项、风险、复盘清单、生成依据、问题质量和追问建议都要能被消费；评分、关键词、幸运锚点、置信依据使用系统组件承载。 |
| 查询失败 | 非关键列表、档案和历史使用局部空状态或重试提示，不用全局 toast 淹没工作区。 |
| 反馈 | 用户端反馈只支持评分和短备注，并作为后续追问/同类报告的质量参考。 |
| 配置页 | Console 只做配置、任务、退款、报告和档案运营，不混入用户生成流程。 |
| 设计收敛 | 保留紧凑业务工具栏、问问/今日/关系面板和报告消费；不做用户中心、独立首页 Hero、全局数据看板、复杂分享中心和完整报告资产库。 |

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

验证证据：

| 范围 | 证据状态 | 命令/场景 | 环境基线 | 结论 | 后续条件 |
|---|---|---|---|---|---|
| 单测边界 | current | `pnpm --filter echoflow-astrology-fortune test` 和 focused tests | 2026-06-20 记录 | 覆盖 AI SDK 边界、结构化输出契约、置信度、来源白名单、确定性承诺过滤、复盘清单、继续追问、反馈、通知摘要、public 类型边界、样式边界、RootLayout、Web smoke 脚本、扣费幂等、失败退款顺序、队列入队失败、Worker 崩溃和超时回收归因等边界；仍需补真实模型联调和账务数据库集成测试。 | 相关源码变更或发布前重新执行当前环境下的 targeted test / package test。 |
| Redis/Worker | pending | 真实 Redis/Worker smoke | 需要真实 Redis/Worker 环境 | 未覆盖成功、失败、超时、删除保护和多实例恢复真实闭环。 | 准备服务后执行成功、失败、超时、删除保护和多实例恢复 smoke。 |
| 真实 LLM | pending | 主站真实模型、Secret、余额和测试档案 | 需要真实模型与账务环境 | 未覆盖报告生成与失败退款真实闭环。 | 准备主站真实模型、Secret、余额和测试档案。 |
| Web 构建 | historical | `pnpm --filter echoflow-astrology-fortune build:web` | Node 24 / pnpm 10 历史记录；当前仓库基线为 Node 22.20 / pnpm 10.20.0 | 历史通过；Web 首页和 Console 管理页通过 lazy route 独立拆包，Vite preview HTTP smoke 可访问 HTML、JS 和 CSS 产物。 | 作为发布证据前需在当前 Node 22.20 / pnpm 10.20.0 重新验证。 |
| 浏览器 QA | historical | Vite dev server 与 Playwright/Edge mock 浏览器 QA | 2026-06-20 浏览器记录 | 曾发现 `localhost:5173` 实际是视频插件 dev server，星盘应确认本插件 dev server 输出端口；mock 环境下 1366x900 与 390x844 报告态可见 AI 摘要、分数、关键词/依据、三档置信、行动、风险、复盘、继续追问和反馈入口，无 React page error 与横向滚动。 | 当前交付前需重新确认端口、title、业务文案和桌面/移动截图；mock 未拦截资源日志不作为真实主站错误。 |
| CLI 复验 | historical | `check-types`、`build:api`、`build:web`、`build:publish`、`smoke:web` token 缺失 fail-closed | 2026-06-20 记录 | 当时通过类型、API/Web/发布构建；`smoke:web` 在未提供 token 时按设计失败；同时确认 `@buildingai/extension-sdk` dist 中 `utils/pure`、`provider-config` 等公开导出产物存在。 | 当前发布证据需重新执行最小验证；真实生成 smoke 必须提供 token 且显式设置真实生成开关。 |

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
| P1 真实端到端 smoke | Web 报告工作台、报告 service、主站模型/Secret/余额 | 使用 `pnpm --filter echoflow-astrology-fortune smoke:web` 做用户端公开 API smoke；默认只验证登录、generation-status、档案和历史列表，设置 `ASTROLOGY_SMOKE_GENERATE=1` 后才进入真实生成、队列轮询、扣费、结构化结果、反馈和继续追问。 | 必须提供 `ASTROLOGY_SMOKE_TOKEN` 或 `BUILDINGAI_ACCESS_TOKEN`；记录脱敏报告 ID、账务事实、AI 结构字段、反馈 metadata、追问上下文和失败退款事实；Web 不暴露模型/Provider/Secret/raw/修复审计字段。 |
| P1 Redis/Worker smoke | BullMQ processor、超时回收、删除保护 | 覆盖成功、模型格式异常失败、provider 失败、超时回收、软删除保护、退款异常、服务重启恢复和多实例重复恢复。 | 不重复扣费、不重复通知；Console 任务页能看到 failureType、failureReason、退款异常和 AI 修复状态。 |
| P1 真实模型与账务测试 | `tests/*`、Console 任务页、计费 service | 补真实模型联调脚本、账务数据库集成测试和 Console 任务页 focused tests。 | 测试能证明扣费幂等、失败退款顺序和脱敏排障字段；Web 不暴露模型/Provider/Secret。 |
| P2 反馈实体化评估 | 报告 metadata、可选反馈实体、Console 统计 | 按正式运营需求决定是否把反馈 metadata 迁移为独立实体。 | 没有大规模统计需求时继续 metadata；若迁移，提供 migration、serializer 和 Console 查询边界。 |
| P2 用户端文案继续收敛 | Web 页面、报告卡、详情、模板问题 | 继续压缩用户端技术词，保持智能感来自分析结构、行动项和上下文来源。 | 用户端不出现 Provider、模型 ID、原始 payload；无可用模型时输入与提交保持禁用。 |
