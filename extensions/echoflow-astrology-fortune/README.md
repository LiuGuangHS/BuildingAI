# AI 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的星盘与运势报告插件。插件基于出生信息、星座生肖、长期档案和用户问题生成每日运势、性格洞察、情感配对、事业财富与生活决策建议；报告生成走主站 LLM，按报告类型计费，并提供失败退款保护。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 付费模型解读工作台，不是普通星座小工具。 |
| 用户端 | 多 Tab 工作台：档案、每日、问问、配对、历史与结果。 |
| Console | 概览、模型与价格、报告记录、任务与退款、用户档案。 |
| 文案 | 用户端讲分析范围、扣费和退款；Console 保留模型/AI 运维术语。 |
| 视觉 | 回归主系统 Card、Tabs、Button、Dialog，不使用整页星空、玻璃拟态或大面积 AI Hero。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 用户档案 | ready | 保存出生信息、星座生肖、长期档案和上下文。 |
| 报告生成 | ready | 按报告类型创建异步任务，成功写结构化结果、摘要和模型快照。 |
| 报告类型 | ready | 支持每日运势、性格洞察、情感配对、事业财富和问题解读等类型。 |
| 继续追问 | ready | 不新增聊天实体，追问会回到“问问”工作区复用报告生成入口。 |
| 质量反馈 | ready | 轻量反馈写入报告 metadata，字段受限、可回显、可审计。 |
| 多页面 Console | ready | `consoleRoutes` 拆为概览、模型与价格、报告、任务退款和档案。 |
| 计费退款 | ready | 使用主系统算力账本，报告失败按账务事实退款。 |
| 队列报告 | ready | 报告生成接入主系统 `QueueModule` / BullMQ，不保留进程内 fallback。 |
| 终态保护 | ready | 超时回收和异常失败写回逐条加锁，只允许 `PENDING/PROCESSING` 报告进入失败态。 |
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
| Console | `@ExtensionConsoleController("astrology-fortune", "AI星盘运势管理")` | 模型价格、报告、任务退款、档案和统计。 |

关键模块：

| 模块 | 说明 |
|---|---|
| `astrology-fortune.module.ts` | 导入主站 AI、计费和队列能力，注册报告服务。 |
| `astrology-fortune.service.ts` | 档案、报告任务、LLM 调用、结构化结果、扣费退款、超时回收和删除保护。 |
| `dto/astrology-fortune.dto.ts` | 用户端和管理端请求/响应约束。 |
| `src/web/constants/report-types.ts` | 用户端报告类型、展示文案和分析范围。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| LLM | 通过 `AiPublicModule` / `PublicAiModelService` 获取模型、Provider Config 和 adapter。 |
| Provider Config | 使用 `normalizeProviderConfig()` 读取主站 Secret 字段别名；插件只保存主站模型 ID。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款。 |
| Queue | 报告生成使用主系统 `QueueModule` / BullMQ；队列不可用时标记报告失败并返回可观测错误。 |
| Notification | 通过 `ExtensionNotificationService` 注册报告生成成功和报告生成失败场景；通知投递失败不影响报告终态。 |
| UI | 用户端和 Console 复用主系统 Tabs、Card、Button、Dialog、表单组件和局部空状态。 |
| 数据 | 轻量反馈先写入业务记录 metadata；若需要全量运营统计，再迁移为独立实体。 |

## 用户体验规则

| 主题 | 要求 |
|---|---|
| 付费说明 | 每个生成入口展示分析范围、价格组或扣费规则、失败/退款保护。 |
| 首屏 | 优先展示当前档案、当前问题、生成按钮和最近结果，不把模型机制放到主视觉层级。 |
| 继续追问 | 将追问问题带回 `问问` 工作区，复用 `/astrology-fortune/reports/generate`。 |
| 结果区 | 展示行动项、摘要、参考来源和质量反馈。 |
| 查询失败 | 非关键列表、档案和历史使用局部空状态或重试提示，不用全局 toast 淹没工作区。 |
| Console | 只做配置、任务、退款、报告和档案运营，不混入用户生成流程。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 档案、报告、配置和任务记录使用插件实体。 |
| Migration | 首版表结构位于 `src/api/db/migrations/`，migration 产物需进入发布包。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等写入主系统 extension 安装记录。 |
| 报告状态 | 报告包含 `PENDING`、`PROCESSING`、成功、失败、退款等状态，处理中禁止删除。 |
| 软删除 | 退款补偿可用 `withDeleted: true` 查询历史异常报告。 |
| 结果 | 保存结构化结果、文本、摘要、模型快照和有限 metadata，不保存密钥或未脱敏上游响应。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 报告入库后以报告 ID 作为 `associationNo` 幂等预扣。
- 模型调用失败时报告标记为 `failed` 并按账务事实自动退款。
- 退款失败写入 `providerMetadata.refundError`，便于任务退款页排查。
- 即使报告已软删除，补偿和退款错误记录仍可读取历史记录处理。

## 开发与验证

```bash
pnpm --filter echoflow-astrology-fortune check-types
pnpm --filter echoflow-astrology-fortune build:api
pnpm --filter echoflow-astrology-fortune build:web
pnpm --filter echoflow-astrology-fortune build:publish
```

`build:web` 使用 `vite.config.mjs` 和 `--configLoader native`。若 Vite/Rolldown 在配置加载或 HTML entry 解析阶段失败，先用最小 HTML smoke 区分工具链问题与插件业务代码问题。

当前验证缺口：

| 项目 | 状态 |
|---|---|
| 单测 | 当前 package 未定义 `test` 脚本；需要补报告生成、计费幂等、超时回收、反馈和退款测试。 |
| Redis/Worker | 需要真实 smoke 成功、失败、超时、删除保护和多实例恢复。 |
| 真实 LLM | 需要主站真实模型、Secret、余额和测试档案覆盖报告生成与失败退款。 |
| Web 构建 | 需在当前 Node 22 / pnpm 10 环境重新确认构建链路。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 队列拓扑未 smoke | 不能声明多实例、重启恢复和超时补偿生产闭环。 | 覆盖 Redis/Worker 成功、失败、超时和删除保护。 |
| 真实模型未联调 | 报告质量、结构化输出和失败退款仍需正式验证。 | 准备主站模型、Secret、余额和档案样本。 |
| 反馈仍在 metadata | 适合轻量回显，不适合大规模运营统计。 | 需要运营统计时迁移为独立反馈实体。 |
| 星盘内容合规 | 建议可能被用户误解为确定性承诺。 | 文案持续强调分析建议、参考范围和退款保护。 |

## 下一步

| 优先级 | 任务 |
|---|---|
| P1 | 真实端到端 smoke：档案、报告生成、失败退款、反馈和继续追问。 |
| P1 | Redis/Worker smoke：成功、失败、超时回收、删除保护和退款异常。 |
| P1 | 补报告生成、计费幂等、超时任务回收、反馈和 Console 任务页 focused tests。 |
| P2 | 按正式运营需求决定是否把反馈 metadata 迁移为独立实体。 |
| P2 | 继续压缩用户端技术词，保持智能感来自分析结构、行动项和上下文来源。 |
