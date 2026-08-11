# 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的出生档案与 AI 分析插件。当前严格接受 `YYYY-MM-DD` 出生日期，按公历日期计算太阳星座，按公历年份计算“公历年生肖”，再结合出生资料、用户补充信息和问题生成生活分析与提问建议；报告生成走主站 LLM，按报告类型计费，并提供失败退款保护。月亮星座和上升星座如果填写，只是用户补充信息，不是系统计算的星盘事实。传统农历生肖和完整本命盘能力尚未提供。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 主系统内嵌的付费模型解读业务面板，不是普通星座小工具，也不是独立完整应用。 |
| 用户端 | 紧凑多 Tab 业务面板：每日、问问、配对、档案、报告；只展示生成所需上下文和结果操作。 |
| Console | 概览、模型与价格、报告记录、任务与退款、用户档案。 |
| 文案 | 用户端讲分析范围、扣费和退款；Console 保留模型/AI 运维术语；明确太阳星座按公历日期、公历年生肖按公历年份，月亮/上升是用户补充信息。 |
| 视觉 | 作为主系统 iframe 内的插件面板，回归主系统 Card、Tabs、Button、Dialog，不使用整页星空、玻璃拟态、大面积 AI Hero 或独立 App 外壳；桌面两列工作区按内容顶部对齐，输入面板不为了追平右侧报告而拉伸成整页高度。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 用户档案 | ready | 保存出生信息、按公历日期计算的太阳星座、按公历年份计算的公历年生肖、用户补充的月亮/上升信息、长期档案和上下文。 |
| 报告生成 | partial | 按报告类型创建异步任务；固定 requestKey 防止同一用户请求重复创建报告，成功写结构化结果、判断依据、摘要、完整文本、通知摘要和模型快照；真实 Postgres/Redis/Worker/账务并发闭环仍 pending。 |
| 生成状态 | ready | Web 公开 `/astrology-fortune/generation-status`，只返回 `canGenerate`、`unavailableReason` 和公开价格组；无可用 LLM 或配置暂停时，今日、问问、关系、模板、参数和重新生成入口统一禁用，不泄漏模型 ID、Provider、Secret、Base URL 或 Console 排障字段。 |
| 生成上下文 | ready | Web 公开 `generationContext`，记录报告类型、关注方向、当前状态、问题、语言、是否包含目标对象和脱敏问题质量；后端同步计算问题质量上下文并进入 request payload / prompt；用户端问题质量面板会解释已包含信息、建议补充项和对 AI 输出的影响；太阳星座按严格 `YYYY-MM-DD` 公历日期计算，公历年生肖只按公历年份；月亮/上升仅作为用户补充信息，不进入系统计算事实；不暴露原始目标对象、模型、Provider 或请求载荷。 |
| AI 结果契约 | ready | 模型输出必须是结构化 JSON，并通过后端 schema 校验；`evidence` 来源只能来自用户档案、当前状态、问题质量、目标对象、追问来源或用户反馈，每条都必须给出 `confidence` 的 low/medium/high 等级，后端不补默认置信度；即使包含白名单词也会拒绝“未提供、缺失、未知、猜测、推测、虚构、编造”等不可用上下文；标题、摘要、依据、段落、行动、风险、复盘、追问和结尾不能使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺；`actions` 与 `warnings` 必须能回到本次 `evidence` 的 source/insight，避免漂亮但脱离依据的泛化建议；首次输出为空、非 JSON 或结构异常时只做一次格式修复重试，仍不放宽 schema，第二次仍失败才进入格式异常失败和账务事实退款；修复成功会在报告 metadata 记录 `aiRepairAttempted`、`aiRepairSucceeded` 和脱敏 `aiRepairReason`，供 Console/后续 smoke 观察模型输出质量。 |
| 报告类型 | ready | 支持每日运势、性格洞察、情感配对、事业财富和问题解读等类型。 |
| AI 复盘清单 | ready | 报告结果必须包含 `reviewChecklist`，把判断依据、行动建议和风险提醒转成可观察、可勾选、可导出的复盘项；用户端、Console 详情、复制/下载和成功通知摘要都保留该结构，让 AI 判断能被后续验证。 |
| 继续追问 | ready | 不新增聊天实体，追问会回到“问问”工作区复用报告生成入口；报告结果可返回 `followUps`，用户端优先展示模型生成的追问建议，并在问问区显示“基于上一份报告继续”的来源提示和清除上下文入口；来源报告摘要、带 low/medium/high 置信度的判断依据、行动项、风险提醒、复盘清单和脱敏反馈作为白名单上下文进入队列 payload 与 AI prompt；追问 prompt 明确要求 high 置信依据可延续判断、medium 需要补观察、low 只能作为待验证线索。 |
| 质量反馈 | ready | 用户端反馈面板支持评分和一条短备注，轻量写入报告 metadata，字段受限、可回显、可审计；继续追问时会把来源报告的评分和备注摘要带入 prompt，形成质量反哺。 |
| 多页面 Console | ready | `consoleRoutes` 拆为概览、模型与价格、报告、任务退款和档案。 |
| 计费退款 | partial | 使用主系统算力账本；报告失败先锁定并提交 FAILED，再按账务事实退款，按报告 ID 防止重复扣费/退款；真实账务并发验证仍 pending。 |
| 队列报告 | partial | 报告生成接入主系统 `QueueModule` / BullMQ，不保留进程内 fallback；入队失败、Worker 崩溃和超时回收都会写失败态并记录受限 `failureType/failureReason`，稳定 jobId 与 requestKey 防止重复任务；真实 Redis/Worker 闭环仍 pending。 |
| 终态保护 | ready | Worker 崩溃、超时回收和异常失败写回逐条加锁，只允许 `PENDING/PROCESSING` 报告进入失败态，并保留失败归因 metadata。 |
| 任务恢复 | partial | 实现 `onModuleInit` 启动恢复（recoverInterruptedReports + failStaleReports），事务内悲观锁（`pessimistic_write`）+ CAS 二次校验（`canRecoverAstrologyReport`/`canClaimAstrologyReportForProcessing`）防止多实例重复入队；API 运行期间的自动 stale scan 尚未实现。 |
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
| Public 边界 | Web 不返回用户 ID、模型 ID、Provider、Secret、原始 payload、Base URL、AI 修复审计或 Console 排障字段；Console 也只返回显式 allowlist 运营诊断，不返回原始 requestPayload、目标对象、Secret、Base URL、上游响应或处理锁。 |

依赖边界：用户端页面直接 import `sonner` 的 `toast`，因此插件 `package.json` 显式声明 `sonner`；不要依赖视频或图片插件的同名依赖偶然存在。AI 生成统一使用主系统 `PublicAiModelService.generateText()`；主系统边界内复用 Provider/Secret 归一化，插件不读取 Secret、不创建 Provider adapter、不请求 Provider Config。

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
| 报告状态 | 报告状态只有 `PENDING`、`PROCESSING`、成功、失败；失败报告的退款是账务 metadata，不是独立报告状态，处理中禁止删除。 |
| 软删除 | 退款补偿可用 `withDeleted: true` 查询历史异常报告；活动报告的 requestKey 不能复用，软删除后允许复用；历史空 requestKey 不受唯一约束影响。 |
| 结果 | 保存结构化结果、判断依据、AI 复盘清单、模型生成追问建议、完整复制文本、摘要、模型快照和有限 metadata，不保存密钥或未脱敏上游响应；用户端复制/下载以结构化结果重建文本为优先，兼容历史 `resultText`。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检；同一 requestKey 命中已有报告时直接返回，不重复执行余额检查、入队或账务动作。
- 成功写入报告结果时以报告 ID 作为 `associationNo` 幂等扣费；同一报告只允许一条扣费事实。
- 失败处理先在报告行锁内确认 `PENDING/PROCESSING` 并原子写入 `FAILED`，事务提交后才按账务事实退款，避免成功报告被退款。
- 退款失败只写受限 `providerMetadata.refundError` / `refundFailedAt`，不把原始账务错误返回 Web 或通知。
- 报告状态只有 `PENDING`、`PROCESSING`、`SUCCESS`、`FAILED`；退款不是独立报告状态。
- 即使报告已软删除，补偿和退款错误记录仍可读取历史记录处理；requestKey 唯一索引只约束未软删除记录。

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
| 账务与终态竞争 | stale scan 若先退款、Worker 随后成功写回，可能产生成功报告已退款的账务不一致。 | 将抢占失败终态与退款判定收敛为同一行锁/CAS 状态机，并补 Postgres 并发集成测试。 |
| 生成请求非幂等 | 双击或网络重试会创建多份报告、任务和账务记录。 | 使用固定请求号；数据库限制同一用户同一请求号只能有一份未删除报告；创建前后各查询一次。 |
| 报告输入不可重放 | Worker 重新读取可变 Profile，提交后修改档案会改变已入队报告的依据。 | 创建报告时保存不可修改的报告依据和星盘结果副本；Worker 只读取保存的副本。 |
| 队列拓扑未 smoke | 不能声明多实例、重启恢复和超时补偿生产闭环。 | 覆盖 Redis/Worker 成功、失败、超时、删除保护和多实例恢复。 |
| 真实模型未联调 | 报告质量、结构化输出和失败退款仍需正式验证。 | 准备隔离测试账户、模型、Secret、余额和档案样本。 |
| 领域输入不足 | 自由文本地点、可选时间和手填月亮/上升不能支持可信宫位、上升或行运。 | 先定义规范地点、全球统一时区名称、夏令时处理和时间精度；资料不足时只生成资料不足结果。 |
| 星盘精度与许可证未决 | 当前没有天文计算引擎、星历数据版本或固定正确答案样本；Swiss Ephemeris 可能涉及开源协议或商业授权。 | 完成产品、法务、数据与数值验收门禁前，不引入星历依赖或宣传完整本命盘。 |
| Web 主入口偏大 | Console 已从用户端入口拆出，但用户端主入口仍超过 500 KB。 | 按业务工作区拆 lazy boundary，真实星盘 renderer 必须按需加载。 |

## 长期产品边界

| 层级 | 当前状态 | 对外承诺 |
|---|---|---|
| 出生档案与 AI 分析 | ready | 基于用户档案、太阳星座/生肖和问题生成参考性分析；手填月亮/上升是用户补充信息，不是计算事实。 |
| 可重放付费报告 | partial | 现有队列与账务基础已具备，但仍需请求幂等、冻结输入和持续恢复。 |
| 确定性本命盘 | not ready | 需要规范出生时间、地点、IANA 时区、版本化计算引擎、星历数据、宫制和 golden fixtures。 |
| 兼容性与行运 | not ready | 必须同时冻结双方 snapshot 或观测瞬时；不允许由任意 JSON 或浏览器时区推断。 |

完整星盘只由后端确定性计算生成。AI 只能解释当前报告引用的事实，不能创建或回写星体、宫位、相位、上升点或行运事实。

## 模块重构说明

当前 `AstrologyFortuneService` 同时处理档案、创建报告、扣费退款、队列恢复、AI 提示词和公开返回值，职责过多。重构目标不是一次拆成很多小文件，而是把每项业务放到一个清楚的位置。

| 模块 | 负责什么 | 不负责什么 | 何时拆出 |
|---|---|---|---|
| `astrology-profile.service.ts` | 创建、修改、删除出生档案；保存档案版本。 | 不生成报告，不扣费。 | 阶段 2：报告需要保存“提交当时的档案副本”时。 |
| `astrology-report-orchestrator.service.ts` | 创建报告、检查重复提交、写入报告状态、投递队列。 | 不直接调用模型，不直接退款。 | 阶段 1：加入 `requestKey` 后。 |
| `astrology-report-billing.service.ts` | 报告扣费、失败退款、避免重复扣费和重复退款。 | 不决定报告内容。 | 阶段 1：修复成功报告被退款的竞争问题时。 |
| `astrology-report-recovery.service.ts` | 检查长期卡住的任务，安全地恢复或标记失败。 | 不重新计算报告内容。 | 阶段 3：加入定时检查时。 |
| `astrology-input-snapshot.ts` | 把用户提交时的档案、问题、目标对象整理成一份不可修改的报告依据，并计算固定标识。 | 不读取之后更新过的档案。 | 阶段 2。 |
| `astrology-report-prompt.ts` | 把冻结的报告依据转换成模型提示词。 | 不负责存库、扣费或队列。 | 阶段 2。 |
| `astrology-chart-calculator.ts` | 根据完整出生资料计算星盘。 | 不调用 AI，不处理页面。 | 阶段 7：许可证和计算引擎批准后。 |
| `astrology-chart-facts.ts` | 保存“太阳在什么位置”“哪些相位存在”等可核查结论及其来源。 | 不写生活建议。 | 阶段 7。 |
| `astrology-public-serializers.ts` | 决定用户端和管理端各自可以返回哪些字段。 | 不做数据库查询。 | 已完成；继续集中维护。 |

下面是**完成全部阶段后的目标结构，不是当前代码结构**。名称代表职责，不要求现在一次全部创建：

```text
api/modules/astrology-fortune/
├── dto/                         请求参数和返回参数的校验规则
├── services/
│   ├── astrology-profile.service.ts
│   ├── astrology-report-orchestrator.service.ts
│   ├── astrology-report-billing.service.ts
│   ├── astrology-report-recovery.service.ts
│   ├── astrology-input-snapshot.ts
│   ├── astrology-report-prompt.ts
│   ├── astrology-chart-calculator.ts
│   ├── astrology-chart-facts.ts
│   └── astrology-public-serializers.ts
├── processors/                  队列任务，只读取已冻结的报告依据
└── db/
    ├── entities/                档案、报告、档案版本、星盘计算结果
    └── migrations/              数据库结构升级记录
```

前端也按用户实际操作拆分，不按文件长度拆分：

| 页面/组件 | 用户能做什么 | 加载时机 |
|---|---|---|
| `pages/index.tsx` | 保留最小外壳、当前报告摘要和生成是否可用。 | 首次打开。 |
| `user/today-view.tsx` | 生成今日分析。 | 首次打开。 |
| `user/profile-manager.tsx` | 创建和修改出生档案，看到资料是否足够。 | 打开“档案”后。 |
| `user/report-history.tsx` | 查看历史报告和完整详情。 | 打开“报告”后。 |
| `user/relationship-panel.tsx` | 填写双方资料并生成关系分析。 | 打开“关系”后。 |
| `user/chart-view.tsx` | 查看真实星盘图和文字说明。 | 只有后端已提供真实星盘结果时。 |
| `console/tasks.tsx` | 单独查看等待中、处理中和失败的任务。 | 打开“任务”后。 |

重构顺序：先从现有大 Service 中抽出“冻结报告依据”和“公开返回字段”这类不依赖数据库的逻辑；再抽扣费、恢复和档案服务；最后再拆页面。保留 `AstrologyFortuneService` 作为暂时入口，直到 Controller 和队列任务都稳定切换，避免一次改动所有调用点。

说明：

- **冻结报告依据**：用户点击生成那一刻，把档案和问题复制到报告中。以后用户修改档案，旧报告仍按旧资料生成和展示。
- **固定请求号 `requestKey`**：同一次点击或网络重试使用同一个号，只创建一份报告、只扣一次费。
- **安全状态更新**：更新任务前先确认它仍是等待或处理中，避免超时检查把刚成功的报告改成失败。
- **资料不足结果**：没有准确出生时间或地点时，只显示能确定的内容，不编造上升星座、宫位或相位。

## 开发阶段计划

先说明路线中几个容易误解的词：

- **固定请求号**：用户一次点击生成会带一个唯一编号。网络重试仍使用同一编号，所以不会重复生成或重复扣费。
- **冻结报告依据**：把点击生成那一刻的档案和问题保存到报告里。之后修改档案，旧报告不变。
- **资料不足结果**：出生时间或地点不够准确时，系统只显示能够确认的内容，不猜测上升星座、宫位或相位。
- **可重复计算**：同一份出生资料、同一套计算规则和同一版数据，任何时间重新计算都得到同样结果。
- **星盘事实**：计算得出的天体位置、宫位和相位。AI 只能解释这些结果，不能自行编造。
- **IANA 时区**：全球统一的时区名称，例如 `Asia/Shanghai`、`America/New_York`，用来正确处理历史夏令时。
- **夏令时不存在/重复时间**：调快时钟会出现不存在的时间；调慢时钟会出现同一时间两次。系统必须拒绝前者，并让用户选择后者对应的实际时刻。
- **固定样本测试**：使用事先写好的出生资料和预期结果测试计算是否正确。样本必须来自独立可靠的参考资料，不能由待测试代码自己生成。
- **输入校验对象**：服务端收到请求后，用于检查字段是否存在、格式是否正确、是否超长的规则。
- **第三方声明清单**：发布插件时随包提供的第三方依赖、许可证和署名说明。

| 阶段 | 要做什么 | 完成标准 | 必须审查 |
|---|---|---|---|
| 0. 产品事实和基础规则 | 修改商店文案、README、太阳星座和生肖规则。生日只接受 `YYYY-MM-DD`，不再依赖服务器所在时区。明确“生肖”是公历年生肖，不将用户填写的月亮/上升描述成系统计算事实。 | `tests/astrology-calendar.test.mjs` 列出 12 个星座交界日的前一天、当天和后一天及预期结果；拒绝时间、时区、空字符串和不存在日期；在 `TZ=UTC`、`TZ=Asia/Shanghai`、`TZ=America/Los_Angeles` 下运行同一测试并逐项一致。传统农历生肖未获批准前，不提供传统农历转换。 | `astrology-domain-reviewer`、`extension-boundary-reviewer` |
| 1. 一次生成只扣一次费 | 已增加固定请求号 `requestKey`；数据库新增“同一用户 + 同一活动请求号”部分唯一约束；失败先进入 FAILED、提交后退款，成功写回不能被晚到失败覆盖。 | 纯函数、源码边界和 Node 22 本地测试已覆盖连续重复、请求号格式、唯一冲突重查、终态退款规则、软删除复用和前端生命周期；真实 Postgres 并发 10 次、BullMQ、账务和通知集成仍 pending，不能将 mock/源码测试描述成生产闭环。 | `security-boundary-reviewer` |
| 2. 固定报告生成依据 | 报告创建时保存当时的档案、问题、目标对象、模型版本和提示词版本；为关系对象建立专用输入校验。 | 提交后修改或删除档案，不影响已经提交的报告。非法嵌套输入返回 4xx。冻结依据和原始请求不出现在用户端或管理端公开接口。 | `security-boundary-reviewer`、`astrology-domain-reviewer` |
| 3. 持续恢复卡住任务 | 增加定时检查，安全处理长期等待或处理中的任务；任务页面使用独立查询，不从报告当前页过滤。 | 自动化集成测试把等待中和处理中任务的更新时间调至超时阈值之前，证明定时检查无需重启便会处理它们。两台服务同时检查同一任务时，断言最多新增 1 次重投、退款和通知。再模拟 Worker 崩溃、报告删除与晚到消息，断言终态报告绝不被覆盖，已删除报告不会复活。 | `security-boundary-reviewer`、`extension-ui-contract-reviewer` |
| 4. 真实环境验证和运营信息 | 补成功、模型格式失败、模型服务失败、队列失败、超时、退款异常的受限诊断和对账；运行真实 smoke。 | 在 Node 22.20、Redis、Postgres、Worker、隔离测试余额和显式生成开关下获得真实记录；日志不打印密钥、原始请求或模型原始响应。 | `security-boundary-reviewer` |
| 5. 规范出生资料 | 保存当地日期、当地时间、时间精度、坐标、IANA 时区和夏令时处理结果。 | 夏令时不存在的时间明确拒绝；重复时间必须让用户选择偏移；未知时间只能得到资料不足结果。 | `astrology-domain-reviewer`、`security-boundary-reviewer` |
| 6. 选择计算引擎 | 比较纯 JavaScript 候选，检查许可证、数据版本、数值误差、Node 22 和发布环境；只做固定样本实验。 | 许可证、第三方声明、数据条款、性能、数值样本和发布环境全部批准后才能继续。未批准就停止，不接入生产。 | `extension-boundary-reviewer`、`astrology-domain-reviewer` |
| 7. 保存真实星盘结果 | 保存不可修改的星盘计算结果、计算引擎/数据/规则版本和每条可核查事实。AI 报告只能引用这些事实。 | 相同出生资料和版本可以重复得到相同结果；每个报告依据都能找到对应星盘事实；不存在或属于其他报告的事实会被拒绝。 | `astrology-domain-reviewer`、`security-boundary-reviewer` |
| 8. 本命盘、关系和行运 | 后端提供真实本命盘；关系分析同时固定双方资料；行运分析固定观察时间。AI 只解释已算出的事实。 | 精确资料、只有日期、资料不足三种状态清晰。缺出生时间时不显示上升、宫位或相关结论。双人和行运报告都可重复生成。 | 领域、安全、UI reviewer 并行 |
| 9. 使用体验、无障碍和性能 | 拆分低频页面；补加载/错误/空状态和重试；任务独立查询；所有按钮、标签和键盘操作可用；星盘图配文字说明。 | 在 390/768/1366 宽度、键盘操作、200% 缩放、深浅主题下无横向滚动或隐藏操作。首次加载不下载低频页面和星盘图代码。 | `extension-ui-contract-reviewer`、`ecc:a11y-architect`、`ecc:react-reviewer` |
| 10. 发布和长期维护 | 检查发布包、许可证清单、第三方声明、旧报告重放和引擎/时区数据升级差异。 | Node 22 构建、发布包、真实 Redis/Worker/模型/账务验证都有当前证据。未做的项目继续标记为 pending。 | `extension-boundary-reviewer`、`security-boundary-reviewer` |

## 真实星盘依赖与许可证门禁

1. 当前不新增天文依赖。先完成阶段 0 至 5 的产品、输入、防重复扣费和冻结报告依据。
2. 时间与夏令时：优先确认平台标准能力；若引入时间库，必须在插件 `package.json` 显式声明，不能依赖其他插件间接安装的包。
3. 基础星历：只在阶段 6 比较纯 JavaScript、Node 22 可重复运行、许可证兼容的候选（例如 `astronomy-engine`）；实验只跑固定出生资料和预期结果，不写数据库、不调用模型、不收费。
4. `astronomia` 仅作为底层数学备选，不能成为自行手写宫制或相位算法的理由。
5. Swiss Ephemeris / `@swisseph/node` / `sweph` 默认不引入。它们涉及开源协议或商业授权、原生模块和星历数据条款；只有法务书面批准具体版本、商业许可、数据再分发和部署环境后才允许实验。
6. 图形优先原生 SVG 和已有 UI；只有稳定星盘接口已存在且 SVG 不能满足需求时，才评估显式声明的图形依赖。前端不得自行计算收费报告的权威结果。

每个候选必须记录：固定版本、代码和数据许可证、维护状态、Node 22/Docker x64/arm64、Windows/macOS 开发、发布压缩包、第三方声明、固定正确答案样本来源、性能和升级策略。

## 测试与环境门禁

| 证据类别 | 最小验证 | 不可替代的真实证据 |
|---|---|---|
| 静态与单测 | `pnpm --filter echoflow-astrology-fortune check-types`、`test` | 不能证明 Redis、账务、模型或数值精度。 |
| API/Web 构建 | `build:api`、`build:web`、`build:publish` | 不能证明安装后 release runtime。 |
| 计算正确性 | 固定正确答案样本、跨时区/夏令时/资料不足组合、独立参考比对 | 正确答案样本不得由同一待测计算引擎生成。 |
| 队列/账务 | 真实 Postgres、Redis、Worker、多台服务和测试余额 | mock 不能证明数据库锁、重复执行保护、队列行为或账务事务。 |
| 浏览器 | mock API 端到端测试、键盘/响应式/无障碍、真实 iframe QA | 必须确认插件端口、页面标题、资源路径和宿主路由。 |
| 模型 | 显式 `ASTROLOGY_SMOKE_GENERATE=1` 的隔离账户真实检查 | 必须记录脱敏报告 ID、账务动作、最终状态和错误码。 |

默认不得执行 `pnpm install/add/remove`、lockfile 重写、Docker/PM2、数据库写入、真实模型/Secret/账务调用或发布。需要真实证据时，先说明精确命令、账户/余额影响、停机条件和可回滚方式。

## 下一步

阶段 0 已完成：日期严格限制为 `YYYY-MM-DD`，太阳星座不受服务器时区影响，生肖语义明确为公历年生肖，月亮/上升仅作为用户补充信息。传统农历生肖和真实星盘计算仍未实现。

阶段 1 代码已落地：新生成请求强制使用 UUID v4 `requestKey`；同一用户同一活动 requestKey 通过数据库部分唯一索引只保留一份报告，重试复用原报告；失败先安全进入 FAILED 再退款，成功报告不退款，通知使用稳定报告来源和失败重试清除机制。当前只有纯函数、源码边界和 Node 22 本地测试，真实 Postgres/Redis/Worker/账务并发闭环仍 pending，不能宣称生产幂等已验证。

下一阶段从 **阶段 2：冻结报告生成依据和 DTO** 开始：保存提交时的档案、问题、目标对象和版本化生成依据；在此之前不开始真实星盘计算、关系盘、行运、天文依赖或页面大拆分。
