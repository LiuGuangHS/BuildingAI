# 合同生成

`echoflow-contract-generation` 是 EchoFlow 的合同编辑器插件。用户端提供 Word/WPS 风格的合同编辑器，支持一句话起草、AI 法务批注、条款改写、版本保存、上传审查和 Word 导出；缺失事实会自动写成 `【待补充：字段名】` 并生成批注，不会阻塞生成。Console 负责模型配置、合同模板和任务运维。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 面向用户的 Word/WPS 风格合同编辑器 + AI 法务批注助手 + 管理员配置与任务运营。 |
| 用户端 | 起草、上传审查、纸面编辑、AI 法务批注、条款改写、再次审查、导出和查看任务状态。 |
| Console | 模型配置、模板管理、任务列表、失败/退款排查。 |
| 长流程 | 合同生成、上传审查、再次审查和导出走任务状态与队列，不阻塞 HTTP 请求。 |
| 上传 | 上传审查只接受平台上传返回的可信 `fileId`。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 合同起草 | ready | 用户输入业务背景即可起草；模板字段只作为辅助事实，缺失信息会写成 `【待补充：字段名】` 并生成 AI 批注，不阻塞生成。 |
| 上传审查 | ready | 只接收平台 `fileId`，服务端校验上传者、插件归属、类型和大小。 |
| 条款编辑 | ready | 用户端使用 Word/WPS 风格纸面编辑器，底层仍为原生纯文本条款编辑器和本地草稿流程；不依赖 PlateJS。 |
| AI 法务批注 | ready | 风险审查以批注方式呈现，支持按条款定位、采纳、忽略和导出报告。 |
| 再次审查 | ready | 已生成任务可触发再次审查，写回前校验当前任务状态。 |
| Word 导出 | ready | 导出任务写回前校验导出状态，避免覆盖其他终态。 |
| 计费退款 | ready | 使用主系统算力账本，生成前预检、任务入库后预扣、失败按账务事实退款。 |
| 任务恢复 | ready | 实现 `onModuleInit` 启动恢复扫描，事务内悲观锁+CAS二次校验防止多实例重复入队；`reviewing` 超时回到 `draft`、`exporting` 超时回到 `export_failed`，避免交互任务永久 busy。 |
| 队列恢复 | partial | 已有超时恢复和状态抢占逻辑；仍需真实 Redis/Worker smoke。 |
| 真实 LLM smoke | pending | 需要真实主站模型、Secret、余额和文件存储验证完整链路。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-contract-generation/*`；extension bundle / local dev base 是 `/extension/echoflow-contract-generation/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-contract-generation/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-contract-generation/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-contract-generation/` | `src/web/pages/index.tsx` | 合同起草、上传审查、编辑、导出和任务状态。 |
| Console route | `/console/` | `src/web/pages/console/config.tsx` | 模型配置和基础策略。 |
| Console route | `/console/templates` | `src/web/pages/console/templates.tsx` | 合同模板管理。 |
| Console route | `/console/tasks` | `src/web/pages/console/tasks.tsx` | 任务列表、失败、退款和运维排查。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web | `@ExtensionWebController("contract-generation")` | 用户端起草、上传审查、任务状态、再次审查和导出。 |
| Console | `@ExtensionConsoleController("contract-generation", "AI合同管理")` | 配置、模板和任务运维。 |

关键模块：

| 模块 | 说明 |
|---|---|
| `contract-generation.module.ts` | 导入主站 AI、计费和队列能力，注册业务服务。 |
| `contract-generation.service.ts` | 任务创建、文件校验、队列入队、LLM 调用、状态写回、扣费退款和导出。 |
| `controllers/web` | 当前用户工作流，不暴露 Console 字段。 |
| `controllers/console` | 管理端配置、模板、任务和统计。 |
| `dto` | 用户端和管理端输入输出约束。 |

## 用户端边界

| 主题 | 说明 |
|---|---|
| 页面形态 | 用户端运行在主系统插件容器内，只呈现合同业务编辑器，不重复主系统导航、账号、头像、全局统计、模型管理、Provider、Secret 或原始上游响应。 |
| 布局 | 顶部显示文档工具栏，左侧是事实采集/模板/最近合同/上传审查，中间是合同纸面与纯文本编辑器，右侧是 AI 法务批注、条款改写、版本和导出面板。 |
| AI 信号 | AI 能力通过事实、缺失事实、条款数量、高风险数量、来源条款、法务批注、改写建议、价格组预扣和失败退款等可观察信号呈现。 |
| 首屏 | 首屏保持嵌入式插件面板形态，不做独立应用外壳、营销 Hero、全局侧边栏或账号区；模板和最近合同收进抽屉。 |
| 预览 | 本地 Vite 预览可能因主系统 API/session 不可用出现 `Network Error` toast；最终视觉 QA 需要在真实主系统插件容器内复核账号态、API 数据、全局 toast 和主题变量。 |
## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| LLM | 通过主站启用模型起草、审查和改写；插件只保存主站模型 ID，不保存 Provider Secret。 |
| 合同起草 | 缺失事实不会阻塞生成，会写成 `【待补充：字段名】` 并生成 AI 法务批注。 |
| 上传审查 | 只接受平台上传返回的可信 `fileId`，并校验上传者、插件归属、MIME/扩展名和 20MB 大小上限。 |
| 任务队列 | 合同生成、上传审查、再次审查和导出走任务状态与队列；写回前重新校验当前状态。 |
| 计费退款 | 任务 ID 作为 `associationNo` 预扣；失败按账务事实退款，退款异常写入 `providerMetadata.refundError`。 |
| 编辑器 | 用户端是 Word/WPS 风格纸面编辑器，底层仍为原生纯文本条款编辑器和本地草稿流程，不依赖 PlateJS。 |
| 分包 | Web 首页、Console 页面和合同正文工作台均按需 lazy，避免默认入口加载所有管理和编辑器代码。 |
| Public 边界 | 用户端不暴露主站模型密钥、Provider 配置、管理员备注或未脱敏上游响应。 |

依赖边界：API 模块直接 import `express` 的 `Request` 类型，Console JSON 编辑器直接 import `@buildingai/stores`，因此插件 `package.json` 显式声明 `express: catalog:api` 和 `@buildingai/stores: workspace:*`。

## 上传与安全

| 主题 | 规则 |
|---|---|
| 文件来源 | 上传审查只接受平台 `fileId`，不接收任意外部 URL。 |
| 文件校验 | 校验上传者、`extensionIdentifier === "echoflow-contract-generation"`、MIME/扩展名和 20MB 大小上限。 |
| SSRF | 已通过平台校验的本插件上传文件可按 `/uploads/` 路径允许本地或私有化部署域名；任意外部 URL 仍拒绝本机、内网和带凭据地址，并在解析前用主系统 `assertPublicHttpUrl()` 做 DNS 公网校验。 |
| 状态写回 | 生成、上传审查、再次审查和导出成功写回前都在行锁内确认当前动作状态。 |
| 删除保护 | 处理中、审查中、导出中任务默认不能删除。 |
| 用户端返回 | 不暴露主站模型密钥、Provider 配置、管理员备注或未脱敏上游响应。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | 合同任务、模板、配置、版本和导出记录使用插件实体。 |
| Migration | 首版表结构位于 `src/api/db/migrations/`，合同插件 migration 产物需进入发布包。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 幂等写入主系统 extension 安装记录。 |
| 文件 | 上传文件通过平台记录校验；导出文件保存 URL、文件 ID 或相对路径，不把大文件/base64 放入数据库。 |
| 状态 | 任务状态区分生成、审查、导出、失败和完成，便于恢复与补偿。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 任务入库后预扣，使用任务 ID 作为 `associationNo` 避免重复扣费。
- AI 或导出失败时按账务事实退款，退款失败写入 `providerMetadata.refundError`。
- 上传审查按任务成本预扣；已生成任务的再次审查和条款改写当前按“生成后免费”策略处理。

## 开发与验证

```bash
pnpm --filter echoflow-contract-generation check-types
pnpm --filter echoflow-contract-generation build:api
pnpm --filter echoflow-contract-generation build:web
pnpm --filter echoflow-contract-generation test
pnpm --filter echoflow-contract-generation build:publish
```

`build:web` 使用 `vite --configLoader native`。若 Vite/Rolldown 在配置加载或 HTML entry 解析阶段失败，先用最小 HTML smoke 区分工具链问题与插件业务代码问题。

验证证据：

| 范围 | 证据状态 | 命令/场景 | 环境基线 | 结论 | 后续条件 |
|---|---|---|---|---|---|
| Node 边界测试 | current | 插件测试覆盖 view-model、public/admin 类型边界、AI 推理文案、路由分包、RootLayout 查询上下文、Web 高成本入口 SDK 限流、纯文本编辑器 source 边界和任务恢复规则 | README 当前记录 | 现有测试约束前端体验和 public/Admin 边界。 | 修改编辑器、serializer、路由分包、任务恢复或限流后重新执行相关 package test。 |
| Web 构建 | pending | `pnpm --filter echoflow-contract-generation build:web` | 当前任务未执行 | 需要验证 Tailwind 工具类、BuildingAI UI 组件和 Vite 打包。 | Web 体验、Vite 配置或 UI 依赖变更后执行；若 Vite/Rolldown 失败，记录命令、错误和是否属于插件代码。 |
| 浏览器检查 | pending | 当前嵌入式宽度和一个移动宽度 | 需要真实主系统插件容器或确认属本插件的 dev server | 未记录当前浏览器证据。 | 首屏应为任务条、输入栏、合同正文、上下文 Inspector；不得出现主系统导航/账号/全局统计/Provider/Secret/原始响应。 |
| 长期文档收口 | current | README 维护规则 | 当前 README 事实 | 临时计划和 QA checklist 不作为长期文档保留；有效结论合并回本 README。 | 新 QA 结论只合并仍有效事实、风险和下一步。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 真实 Redis/Worker 未 smoke | 队列恢复、重复执行保护和超时补偿已有单测/启动规则，仍未声明生产闭环。 | 覆盖入队失败、重启恢复、超时任务和软删除保护。 |
| 真实 LLM/文件存储未 smoke | 合同生成、审查、导出和退款不能声明完整联调。 | 准备主站 Secret、测试用户、余额和部署域名。 |
| 动态队列 SDK 缺口 | 当前插件注册业务队列；若主系统未来提供统一 enqueue API，应迁移。 | 保持 README 记录，避免重复封装。 |
| 文件归属边界敏感 | 上传审查不能退化成任意 URL 解析。 | 补 fileId 校验、URL 拒绝、大小和 MIME 测试。 |
| Web 主入口偏大 | Console 页面和合同正文工作台已 lazy 拆出；用户端工作台的输入、Inspector 和状态编排仍在主入口，仍需复验 chunk warning。 | 后续按生成、审查或 Inspector 重组件继续拆分懒加载，复验 chunk warning。 |

## 下一步

| 任务 | 范围/文件 | 具体步骤 | 验收 |
|---|---|---|---|
| P1 真实端到端 smoke | Web 合同工作台、上传、队列、计费、导出 | 准备主站 Secret、测试用户、余额和文件存储，按“起草 -> 上传审查 -> 条款编辑 -> 再次审查 -> Word 导出 -> 失败退款”跑一条完整链路，并额外覆盖非法 fileId、错误 MIME、越权文件和超大文件。 | 记录脱敏任务 ID、fileId、账务事实和导出文件；非法文件在提交模型前被拦截；用户端不暴露模型/Provider/Secret/raw。 |
| P1 Redis/Worker smoke | BullMQ 队列、恢复扫描、软删除保护 | 覆盖入队失败、服务重启恢复、重复执行保护、生成/审查/export 超时补偿、软删除后异步写回和退款异常。 | 不重复扣费、不覆盖终态；Console 任务页能排查失败类型、退款异常和导出状态。 |
| P1 Focused tests 补强 | `tests/*`、合同 service、DOCX builder、上传边界 | 补起草 payload、上传审查 fileId 归属、DOCX 构建、public serializer、扣费 associationNo 幂等、导出写回保护和任务恢复规则测试。 | 测试失败能定位到合同正文模型、文件归属、账务幂等或状态机边界。 |
| P2 队列 SDK 迁移评估 | 当前插件队列封装、主系统动态队列 API | 若主系统提供动态队列统一 API，迁移当前插件队列封装并删除重复代码。 | 迁移后 README 记录新边界；入队失败和恢复 smoke 仍通过。 |
| P2 运营能力补强 | Console 模板、版本、导出审计 | 按真实运营需求补模板审核、版本对比和导出审计。 | 用户端不暴露审核内部字段；Console 能追溯模板版本、导出来源和失败原因。 |
