# 合同生成

`echoflow-contract-generation` 是 EchoFlow 的合同起草与审查插件。用户端提供嵌入式合同工作台，支持一句话起草、上传审查、条款编辑、AI 法务批注、条款改写、版本恢复和 Word 导出；缺失事实会自动写成 `【待补充：字段名】` 并生成批注，不会阻塞生成。Console 负责模型配置、合同模板、任务运营和失败/退款排查。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、架构边界、验证状态、风险和仍然有效的开发规划。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 面向用户的嵌入式合同工作台 + AI 法务批注助手 + Console 运营能力。 |
| 用户端 | 起草、上传审查、正文编辑、AI 法务批注、条款改写、再次审查、版本恢复、导出和任务状态。 |
| Console | 模型配置、模板管理、任务列表、失败/退款排查。 |
| 长流程 | 合同起草和上传审查使用任务状态与 BullMQ；再次审查和当前 DOCX 导出仍由 Web 请求编排，写回前校验状态。是否将导出纳入队列由真实耗时验证决定。 |
| 上传 | 上传审查只接受平台上传返回的可信 `fileId`。 |
| 编辑器承诺 | 当前使用共享 Plate 的条款级 Markdown/结构化编辑，不承诺原始 DOCX 的完整版式、Word tracked changes、页眉页脚或多人实时协作。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 合同起草 | ready | 用户输入业务背景即可起草；模板字段只作为辅助事实，缺失信息会写成 `【待补充：字段名】` 并生成 AI 批注，不阻塞生成。 |
| 上传审查 | ready | 只接收平台 `fileId`，创建任务时不把 `fileUrl` 写入 Web-visible variables/request payload；Worker 再次校验用户、插件、MIME、扩展名和大小，并优先使用 `createReadStream(fileId, { extensionId })`，缺失 stream 时才使用平台安全 URL 下载。 |
| 条款编辑 | ready | 用户端使用共享 Plate `EditorKit`、Markdown 转换和条款级纸面布局；section ID 在转换和保存中保持稳定。原始 DOCX 完整版式、tracked changes、页眉页脚和多人实时协作不在本阶段承诺内。 |
| AI 法务批注 | ready | Finding 绑定 `sectionId`、`sourceRevision`、quote 和 stale 状态；Inspector 只按稳定 ID 定位，旧版本/无证据项只能人工复制，不能直接采纳。 |
| 再次审查 | ready | 审查 schema 强制返回 `sectionId` 与 quote，写回前校验任务状态、revision 和条款证据；正文变化后旧 Finding 标记 stale。 |
| Word 导出 | ready | 使用现有 `docx` 依赖生成结构化 DOCX；纯文本和 Markdown 由合同专用 AST 统一生成，导出写回前校验导出状态。 |
| 计费退款 | ready | 使用主系统算力账本，生成/上传审查任务以任务 ID 作为 `associationNo` 预扣，失败按账务事实退款。真实退款异常仍未 smoke。 |
| 任务恢复 | ready | 已有启动恢复、事务内悲观锁/CAS、`processingAttemptId` execution fencing 和 `@Cron("*/5 * * * *")` stale 扫描；旧 attempt 的正文、版本、状态、退款和通知写回受限；真实 Redis/Worker smoke 仍未执行。 |
| 本地草稿恢复 | ready | 使用 `@buildingai/stores` 保存 task/template、sections、savedAt 和 baseRevision；刷新恢复，冲突提供恢复本地/保留服务端选择，并限制同 task/模板。 |
| 模板治理 | ready | Console 支持草稿/发布/下线、不可变 versionNo 和发布/下线操作；Web 只返回 published serializer，任务绑定使用时模板行 ID。 |
| 真实 LLM smoke | blocked | 需要真实主站模型、Secret、余额、Redis/Worker 和测试文件；当前外部条件未提供，不能声明真实闭环完成。 |
| 私有文件预览 | pending | 当前没有合同专用的受控 PDF/DOCX 原文预览和 Finding 页码/证据跳转；导出已改为 owner-bound `export-file` endpoint，不向 Web 返回裸 `resultUrl`，也不得将私密合同 URL 发送到公共 Office 在线 Viewer。 |

## 入口与页面

主系统用户入口是 `/apps/echoflow-contract-generation/*`；extension bundle / local dev base 是 `/extension/echoflow-contract-generation/*`。下表 Console 路径是 `consoleRoutes` 相对路径，完整 dev/base 路径形如 `/extension/echoflow-contract-generation/console/...`。

| 入口语义 | 路径 | 文件 | 职责 |
|---|---|---|---|
| 主系统 Web | `/apps/echoflow-contract-generation/*` | `packages/client/src/pages/apps/[identifier]` | 主系统 iframe 宿主入口，加载本插件用户端。 |
| Extension bundle/dev | `/extension/echoflow-contract-generation/` | `src/web/pages/index.tsx` | 合同起草、上传审查、编辑、导出和任务状态。 |
| Console route | `/console/` | `src/web/pages/console/config.tsx` | 模型配置和基础策略。 |
| Console route | `/console/templates` | `src/web/pages/console/templates.tsx` | 合同模板管理。 |
| Console route | `/console/tasks` | `src/web/pages/console/tasks.tsx` | 任务列表、失败、退款和运维排查。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册；用户端工作台和 Console 页面按需 lazy-load。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web | `@ExtensionWebController("contract-generation")` | 用户端起草、上传审查、任务状态、再次审查、条款改写、版本和导出。 |
| Console | `@ExtensionConsoleController("contract-generation", "AI合同管理")` | 配置、模板和任务运维。 |

当前关键模块：

| 模块 | 说明 |
|---|---|
| `contract-generation.module.ts` | 导入主站 AI、计费、上传、通知、Redis 和队列能力，注册业务服务。 |
| `contract-generation.service.ts` | 当前为编排中心，承担任务创建、文件校验、入队、LLM 调用、状态写回、版本、扣费退款、模板和导出；Worker 文件读取和导出下载均复用平台上传/URL 能力。文件较大，后续按稳定边界渐进拆分。 |
| `controllers/web` | 用户工作流和公共响应边界，不暴露 Console 字段。 |
| `controllers/console` | 管理端配置、模板、任务和统计。 |
| `dto` | 用户端和管理端输入约束；外部 AI 输出由 Zod schema 解析后再归一化。 |
| `services/contract-task-recovery-rules.ts` | 任务状态、抢占、恢复和 stale 处理的纯函数规则。 |
| `services/contract-docx.builder.ts` | 基于 `docx` 的结构化 DOCX 导出，不负责原始 DOCX 保真编辑。 |

## 用户端边界

| 主题 | 说明 |
|---|---|
| 页面形态 | 用户端运行在主系统插件容器内，只呈现合同业务编辑器，不重复主系统导航、账号、头像、全局统计、模型管理、Provider、Secret 或原始上游响应。 |
| 布局 | 顶部显示文档工具栏，左侧是事实采集/模板/最近合同/上传审查，中间是合同纸面与条款编辑器，右侧是 AI 法务批注、条款改写、版本和导出面板。 |
| AI 信号 | AI 能力通过事实、缺失事实、条款数量、高风险数量、来源条款、法务批注、改写建议、价格组预扣和失败退款等可观察信号呈现。 |
| 首屏 | 保持嵌入式插件面板形态，不做独立应用外壳、营销 Hero、全局侧边栏或账号区；模板和最近合同收进抽屉。 |
| 预览 | 本地 Vite 预览可能因主系统 API/session 不可用出现 `Network Error` toast；最终视觉 QA 需要在真实主系统插件容器内复核账号态、API 数据、全局 toast 和主题变量。 |
| 草稿 | 已使用 `@buildingai/stores` 的安全 storage helper 保存合同草稿；按 task/template 与服务端 revision 隔离恢复，冲突必须显式选择。 |

## 关键技术边界

| 能力 | 当前实现 | 规划边界 |
|---|---|---|
| LLM | 通过主站启用模型起草、审查和改写；插件只保存主站模型 ID，不保存 Provider Secret。 | 不新增插件私有模型、Provider 或 Secret 系统。 |
| 合同正文 | 任务 JSONB 仍保存 sections；合同专用模型提供 sections ↔ Plate ↔ 最小 Contract AST 转换。 | 保留 JSONB 快照，不先关系化所有条款；P2 再评估确定性质量规则和导出审计。 |
| AI 输出 | `Output.object({ schema })` + Zod schema + 服务端归一化；交互审查强制 `sectionId`/quote。 | 当前 Finding 绑定 source revision/quote/stale；独立 versionId 仍未关系化，真实双客户端与重新审查联调待 smoke。 |
| 上传审查 | 只接受可信 `fileId`，创建和 Worker 执行时都校验上传者、插件归属、MIME/扩展名和 20MB 大小上限；本地读取显式使用扩展 storage root，云/URL fallback 复用平台安全能力；超过 30,000 字明确拒绝。 | P2 再评估稳定边界切块，禁止静默截断。 |
| 任务队列 | 起草和上传审查使用 BullMQ；启动恢复和五分钟 stale 扫描使用悲观锁/CAS。再次审查与当前导出仍在请求内编排。 | 根据真实导出耗时决定是否统一进入队列。 |
| 计费退款 | 任务 ID 作为 `associationNo` 预扣；失败按账务事实退款，异常写入受限 metadata。 | 真实账务/退款异常 smoke 后再扩展策略。 |
| 编辑器依赖 | 已复用共享 `EditorKit`、`Plate`、`EditorContainer`、`Editor` 和 Markdown utils；合同专用 adapter/AST 留在插件目录。 | 不引入 SuperDoc/ONLYOFFICE，也不修改共享 EditorKit。 |
| 文件解析 | 复用 `@buildingai/llm-file-parser`，其 DOCX parser 使用 Mammoth 做文本/结构提取。 | Mammoth 只作为语义解析器，不宣称 Word 版式保真。 |
| DOCX 导出 | 使用插件已有 `docx` 依赖生成 DOCX。 | 通过 Contract AST 统一输出，不让多个导出器直接读取 UI 状态。 |
| 协作 | 当前无实时多人协作。 | 有明确双人编辑需求后再评估 Yjs + Hocuspocus；不为单用户冲突提前引入 CRDT。 |
| Public 边界 | Web task、列表、详情和导出响应使用显式 allowlist；不暴露模型/Provider/Secret、request payload、provider metadata、上传 `fileUrl` 或裸 `resultUrl`；导出使用 owner-bound file endpoint。 | 继续保持显式 serializer，禁止 spread raw entity/provider metadata；私有原文预览仍不在 R0。 |

依赖边界：API 模块直接 import `express` 的 `Request` 类型，Console JSON 编辑器直接 import `@buildingai/stores`，因此插件 `package.json` 显式声明 `express: catalog:api` 和 `@buildingai/stores: workspace:*`。共享 Plate、Mammoth parser 和平台上传/URL/队列能力优先于新增第三方依赖。

## 上传与安全

| 主题 | 规则 |
|---|---|
| 文件来源 | 上传审查只接受平台 `fileId`，不接收任意外部 URL。 |
| 文件校验 | 校验上传者、`extensionIdentifier === "echoflow-contract-generation"`、MIME/扩展名和 20MB 大小上限。 |
| SSRF | 平台 `fileId` 文件通过受控 storage stream 读取；外部 URL 先由 `downloadPublicHttpUrl()` 逐跳重验 DNS/重定向/大小后再 `parseFromBuffer()`；仍拒绝本机、内网和带凭据地址。 |
| 状态写回 | 生成、上传审查、再次审查和导出成功写回前都在行锁内确认当前动作状态。后续还要增加文档/版本 revision 校验，防止旧客户端覆盖新正文。 |
| 删除保护 | 处理中、审查中、导出中任务默认不能删除；软删除后的异步任务不得回写正文、文件或账务终态。 |
| 用户端返回 | 不暴露主站模型密钥、Provider 配置、管理员备注或未脱敏上游响应。 |
| 文件预览 | 不将合同 URL 发送给 `view.officeapps.live.com` 等外部在线 Viewer；需要 PDF/DOCX 原文预览时，优先使用平台受控文件访问和私有化预览能力。 |

## 数据与存储

| 数据 | 当前说明 | 重构方向 |
|---|---|---|
| 合同任务 | `contract_generation_tasks` 保存当前任务和正文 JSONB 快照。 | 保留 JSONB 快照，新增单调 revision 和明确 task/document/version 关联；不先拆出所有条款表。 |
| 合同版本 | `contract_generation_versions` 保存完整版本快照和变更说明。 | 版本必须成为审查、导出和 Finding 的稳定来源；并发保存时检查 base revision。 |
| 模板 | `contract_templates` 保存模板字段、默认条款和后台提示。 | 模板发布后版本化；合同固定绑定使用时的模板版本。 |
| 导出 | 当前结果 URL/fileId 保存在任务 metadata。 | 真实审计需求确认后新增最小 `contract_exports` 记录，记录 source revision、exportType、fileId、状态和失败摘要。 |
| Migration | 首版表结构位于 `src/api/db/migrations/`，合同插件 migration 产物需进入发布包。 | 发布后的 schema 只追加 migration，不修改已发布 migration。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 在同版本启动时使用事务、advisory lock 和持久化 repair marker 执行一次 schema repair；repair 覆盖表结构、列、索引、历史模板回填、重复 published 模板修复和 postcondition。 | 固定 `0.0.1` 下已安装实例的 repair 入口已接入源码 runner，但尚未用真实 PostgreSQL 旧 schema 验证；repair 失败不写 repair marker 或更新 extension 记录。 |
| 文件 | 上传文件通过平台记录校验；导出文件保存 URL、文件 ID 或相对路径，不把大文件/base64 放入数据库。 | 预览、下载和导出审计都使用平台文件授权，不暴露永久裸 URL。 |

## 计费

- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 任务入库后预扣，使用任务 ID 作为 `associationNo` 避免重复扣费。
- AI 或导出失败时按账务事实退款，退款失败写入 `providerMetadata.refundError`。
- 上传审查按任务成本预扣；已生成任务的再次审查和条款改写当前按“生成后免费”策略处理。
- 后续重构需区分生成、上传审查、再次审查、改写和导出的计费策略；任何重试必须复用同一业务动作的幂等关联号。

## 开发规划

规划原则：先补正确性和测试，再拆模块；先复用仓库已有平台能力和依赖，只有真实需求和验证证据成立后才增加新依赖或基础设施。ECC 开发任务按 `AGENTS.md` 的 `/ecc:plan` → `/ecc:tdd-workflow` → `/ecc:code-review` → `/ecc:verification-loop` 执行；涉及上传、URL、队列、计费、文件、数据库或公共序列化时补 `security-boundary-reviewer`。

### P0：合同数据和任务可靠性

| 任务 | 范围 | 验收 |
|---|---|---|
| 文档/版本/revision | done：task 持久化单调 `revision`；保存、采纳、恢复及成功生成/上传审查/再次审查写回均递增；锁内比较 `baseRevision`，冲突返回 409 和最新 revision；保留当前 JSONB 快照。 | Node 边界测试、类型检查和 API 构建已通过；真实双客户端数据库并发 smoke 尚未运行。 |
| 稳定条款证据 | done：Finding 保存 `sectionId`、`sourceRevision`、quote 和 stale；交互审查 schema 强制 sectionId/quote，服务端采纳只按稳定 ID/current revision 写回。 | Node 边界测试覆盖无证据/旧 revision 不可采纳；真实双客户端 smoke 尚未运行。 |
| 上传长文边界 | done：复用 `@buildingai/llm-file-parser`；超过 30,000 字明确拒绝。 | 测试确认不再存在 `content.slice(0, N)` 静默截断；切块合并不在 P1。 |
| 持续任务恢复 | done：启动恢复、悲观锁/CAS 与 `@Cron("*/5 * * * *")` stale 扫描。 | 入队失败、重启、重复任务、stale 超时、软删除回写和退款异常的真实 Redis/Worker smoke 尚未运行。 |
| 本地草稿和冲突 | done：复用 `@buildingai/stores` 保存草稿/baseRevision；同 task/template 恢复，冲突必须选择恢复本地或保留服务端。 | Node 规则测试已覆盖，真实双客户端浏览器 smoke 尚未运行。 |

### P0 完成证据索引

P0 的 revision/CAS、稳定 Finding 证据、长文明确拒绝、Cron stale 扫描和浏览器草稿冲突已实现；证据位于：

- `tests/contract-revision-rules.test.mjs`
- `tests/contract-review-boundary.test.mjs`
- `tests/contract-task-recovery-rules.test.mjs`
- `tests/contract-local-draft.test.mjs`
- `src/api/modules/contract-generation/services/contract-review-rules.ts`
- `src/api/modules/contract-generation/services/contract-task-recovery-rules.ts`
- `src/web/components/contract-workbench/contract-draft-rules.ts`

这些测试与 `check-types`、`build:api`、`build:web`、`build:publish` 已在 Node `v22.20.0` 下通过。固定所有插件版本为 `0.0.1`，因此已有同版本安装实例的新增 schema 不能在本轮声明自动升级完成。

后续只保留真实交付验证和受控部署准备，不重复创建已完成的 P0 实现。


### P1：结构化编辑和审查闭环

| 任务 | 范围 | 验收 |
|---|---|---|
| 复用共享 Plate | done：使用现有 `@buildingai/web/ui` 的 `EditorKit`、`Plate`、`EditorContainer`、`Editor` 和 Markdown utils；合同层只组合条款 adapter。 | AST/Plate 测试覆盖标题、段落、列表、表格、签署栏、空/非法节点与 section ID；不维护第二套编辑器。 |
| Contract AST | done：`src/api/contract-document-ast.ts` 连接 sections、Plate value、规范化纯文本/Markdown、审查 prompt 和 DOCX builder。 | 只承诺结构化 DOCX；高保真 Word 版式不在 P1。 |
| 版本绑定审查 | done：Review Finding 写入 sourceRevision、sectionId、quote 和 stale；正文/采纳/恢复后旧 Finding stale。 | 独立 sourceVersionId 未关系化；重新审查与双客户端真实联调待 smoke。 |
| 条款 Inspector | done：风险项、引用、建议、来源 revision 和 stale 状态按 section ID 定位；无当前证据仅能人工复制。 | 浏览器中长合同定位体验待真实主系统 QA。 |
| Console 治理 | done：模板草稿/发布/下线、versionNo、发布部分唯一约束和显式 public/admin serializer。 | 固定 `0.0.1` 策略下，新增 schema 仅可在首装前合入；已安装实例不得声明可自动升级。 |

### P1：真实交付验证

| 任务 | 范围 | 验收 |
|---|---|---|
| 真实主系统 smoke | 起草 → 编辑 → 保存 → 审查 → 采纳/忽略 → 再审查 → Word 导出。 | 使用测试账号、测试余额、测试 Secret 和测试文件；只记录脱敏 ID、状态和账务事实。 |
| Redis/Worker smoke | BullMQ、Redis、Worker 重启、重复执行和超时补偿。 | 不重复扣费、不覆盖终态；失败原因和退款状态可在 Console 排查。 |
| 文件边界 smoke | 非法 fileId、越权 fileId、错误 MIME、超大文件、危险 URL。 | 非法文件在模型调用前被拒绝；不接收任意外部 URL。 |
| 浏览器 QA | 真实主系统嵌入宽度和一个移动宽度。 | 首屏只有合同业务面板；检查加载、错误、空状态、保存状态和导出反馈。 |

### P2：审计与质量规则

| 任务 | 范围 | 验收 |
|---|---|---|
| 确定性质量规则 | 使用纯函数规则检查金额一致性、未定义术语、日期/期限/付款/验收/违约交叉冲突和待补充占位符。 | 有服务合同 fixture；规则结果可复现，和 LLM Finding 区分来源。 |
| 导出记录 | 在确认真实运营需求后增加最小 `contract_exports` 记录。 | 可追溯导出来源版本、类型、fileId、状态、失败摘要和操作者。 |
| 导出任务化评估 | 先测量 DOCX 构建/上传耗时，再决定是否接入现有队列。 | 不因架构偏好引入队列；若纳入队列，复用现有恢复/通知/计费边界。 |
| 私有原文预览 | 评估现有平台 Open File Viewer 或受控文件预览能力。 | PDF/DOCX 不发送外部在线 Viewer；Finding 可跳转页码/证据时才声明完成。 |

### P3：按需求启用的能力

| 任务 | 触发条件 | 方案 |
|---|---|---|
| 多人实时协作 | 单用户 revision 冲突方案无法满足真实双人编辑需求。 | 评估 Yjs + Hocuspocus；先做权限、持久化、快照和导出一致性 POC。 |
| 原始 DOCX 高保真编辑 | 产品明确承诺保留复杂 Word 版式、批注和 tracked changes。 | 评估 SuperDoc 或自托管 ONLYOFFICE，先做许可证、私有部署、安全和性能评估。 |
| 电子签署 | 需要签署、身份验证和签署审计。 | 单独接入 Documenso/OpenSign/DocuSeal 类签署域，不混入起草审查内核。 |
| 合同类型扩展 | 服务合同质量 fixture 和核心状态机稳定后。 | 以模板版本和规则配置扩展，不为每种合同复制一套 service。 |

## 依赖与参考项目策略

### 已确认优先复用

| 能力 | 优先复用 | 原因 |
|---|---|---|
| 富文本编辑 | 共享 `@buildingai/web/ui` Plate、`EditorKit`、`DocxKit`、Markdown utils | 仓库已有依赖和 UI 适配，不重复引入编辑器。 |
| DOCX 解析 | `@buildingai/llm-file-parser` / Mammoth | 已有平台封装、文件类型识别和解析入口。 |
| DOCX 结构化导出 | 插件已有 `docx` | 当前结构化导出已满足，不先替换。 |
| 上传和文件权限 | `FileUploadService` | 统一 fileId、归属、扩展归属和存储边界。 |
| URL 安全 | `assertPublicHttpUrl()` 等 SDK helper | 不重写 SSRF、DNS、重定向和大小限制。 |
| 队列恢复 | 主系统 QueueModule、BullMQ，以及 image/video 插件的 `@Cron` 模式 | 不新建队列抽象。 |
| 浏览器持久化 | `@buildingai/stores` | 复用现有 JSON/storage 容错 helper。 |

### 参考项目，仅学习边界

| 项目 | 学习内容 | 不直接采用 |
|---|---|---|
| [Wraft](https://github.com/wraft/wraft) | 结构化文档、内容/版式分离、模板、版本、生成管线。 | 不克隆其 AGPL 应用或引入完整文档平台。 |
| [OpenAgreements](https://github.com/open-agreements/open-agreements) | 模板元数据、字段 schema、DOCX placeholder filling 和可自动化接口。 | 不把模板填充替代合同正文和审查领域模型。 |
| [Documenso](https://github.com/documenso/documenso) | 文档流转、模板、签署审计和运营状态。 | 不把签署平台当合同编辑器。 |
| [Tiptap + Yjs + Hocuspocus](https://tiptap.dev/docs/hocuspocus/guides/collaborative-editing) | 未来实时协作的 CRDT、WebSocket、presence、持久化和鉴权边界。 | 没有双人编辑需求前不增加 Yjs/Hocuspocus。 |
| [SuperDoc](https://github.com/superdoc/docx-editor) | 浏览器 DOCX 高保真编辑能力的产品和技术边界。 | 社区版 AGPLv3/商业双许可，未完成许可证和部署评估前不加入。 |
| [ONLYOFFICE DocumentServer](https://github.com/ONLYOFFICE/DocumentServer) | 自托管 DOCX 协作和 Office 文档服务边界。 | 不在插件内私自启动独立文档服务器。 |

## 测试规划

### 当前已有测试

Node 边界测试已覆盖：

- view-model 和 inspector model
- public/admin 类型边界
- AI SDK 和模型配置边界
- 路由 lazy 分包
- RootLayout 查询上下文
- Web 高成本入口限流
- 纯文本编辑器 source 边界
- 任务恢复规则

### 必补测试矩阵

| 层级 | 场景 |
|---|---|
| 纯函数 | 条款规范化、稳定 section ID、Finding 证据定位、revision 比较、状态转换、模板变量校验、确定性质量规则。 |
| DTO/边界 | 起草 payload、嵌套条款、模板字段、上传 fileId、MIME/扩展名/大小、分页和 Console 查询。 |
| Public serializer | Web 不返回 user/model/provider/request/raw metadata/admin fields；错误信息只返回脱敏摘要。 |
| 任务与队列 | 入队失败、重复 request key、Worker 重启、启动恢复、`@Cron` stale 扫描、终态保护、软删除回写、超时补偿。 |
| 账务 | 预检、同一 associationNo 幂等预扣、失败退款、退款失败记录、重试不重复扣费。 |
| 文件 | uploader/extension 归属、危险 URL、内网/带凭据 URL、解析超时、解析失败、超过审查上限时拒绝或分块。 |
| 审查 | 模型结构化输出 Zod 校验、超限归一化、Finding 绑定 version、旧 Finding stale、金额/术语/跨条款规则 fixture。 |
| DOCX | 标题、条款、列表、表格、签署栏、风险报告、特殊字符、空内容、导出失败和写回 CAS。 |
| Web 集成 | 起草、上传审查、编辑保存、自动草稿恢复、冲突选择、采纳/忽略、再次审查、版本恢复、导出。 |
| 浏览器 | 主系统嵌入式桌面宽度、移动宽度、加载/空/错误/处理中/未保存状态、长文滚动和导出反馈。 |

测试采用仓库已有 Node test、包级 typecheck/build 和真实主系统 smoke；只有在确有浏览器交互需求时补 Playwright，不先引入新测试框架。

## 开发与验证

```bash
pnpm --filter echoflow-contract-generation check-types
pnpm --filter echoflow-contract-generation test
pnpm --filter echoflow-contract-generation build:api
pnpm --filter echoflow-contract-generation build:web
pnpm --filter echoflow-contract-generation build:publish
```

`build:web` 使用 `vite --configLoader native`。若 Vite/Rolldown 在配置加载或 HTML entry 解析阶段失败，先用最小 HTML smoke 区分工具链问题与插件业务代码问题。

每个行为变化按以下顺序执行：

1. `/ecc:plan`：确认范围、复用依赖、边界和验收。
2. `/ecc:tdd-workflow`：先补最小失败测试，再实现和回归。
3. `/ecc:code-review`：检查通用质量和安全问题。
4. `security-boundary-reviewer`：涉及上传、URL、队列、计费、文件、数据库或 public serializer 时执行。
5. `/ecc:verification-loop`：执行包级最小验证和必要的真实 smoke。
6. `/ecc:update-docs`：源码事实、验证证据或剩余风险变化时同步本 README。

### 当前验证证据

| 范围 | 证据状态 | 命令/场景 | 结论 |
|---|---|---|---|
| Node 边界测试 | verified（当前环境 Node `v24.18.0`） | `node --experimental-strip-types --test extensions/echoflow-contract-generation/tests/*.test.mjs` | 80/80 通过，覆盖显式 Web task serializer、无裸 `resultUrl`/`fileUrl`、owner-bound 导出、插件 storage root、Worker 二次文件校验、execution fencing、same-version repair 源码契约、共享 AST/Plate、revision/CAS、模板生命周期和 public/admin 边界。测试输出有 Node `MODULE_TYPELESS_PACKAGE_JSON` 警告，但无失败。 |
| Web 构建 | blocked（本轮） | `corepack pnpm --filter echoflow-contract-generation build:web` | 未在 Node `v22.20.0` 运行；当前 Node `v24.18.0` 被 pnpm engine gate 拒绝，未伪造结果。 |
| API 类型/构建 | blocked（本轮） | `corepack pnpm --filter echoflow-contract-generation check-types` | 当前 shell 为 Node `v24.18.0`，仓库要求 `>=22.20.x <23`，pnpm 在 engine gate 前退出；未绕过 engine，也未运行 build。上一轮 Node `v22.20.0` 证据仅覆盖当时源码，不能替代本轮修改后的构建验证。 |
| 发布构建 | blocked（本轮） | `corepack pnpm --filter echoflow-contract-generation build:publish` | 当前 Node `v24.18.0` 被 pnpm engine gate 拒绝；上一轮 Node `v22.20.0` 证据不能替代本轮修改后的发布构建验证。 |
| 浏览器检查 | blocked | 真实主系统嵌入式桌面宽度和移动宽度 | 当前无主系统登录态/测试账号，且浏览器 DevTools 服务未提供；未伪造 QA 结果。 |
| Redis/Worker smoke | blocked | 入队失败、重启恢复、重复执行、stale、退款异常 | 当前无可用 Redis/Worker 测试环境；未声明队列闭环完成。 |
| 真实 LLM/文件/计费 smoke | blocked | 测试 Secret、测试用户、测试余额和测试文件 | 当前无外部凭据和测试余额；未声明真实模型、文件和退款闭环完成。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 双客户端真实并发 smoke 未运行 | 代码已在锁内比较 `baseRevision` 并返回 409，但尚未用真实 PostgreSQL/HTTP 验证两个客户端一个成功、一个冲突。 | P1 外部条件具备后执行双客户端保存、冲突选择和版本链集成测试。 |
| 独立 sourceVersionId 尚未关系化 | Finding 当前绑定 sourceRevision、sectionId、quote 和 stale，但不单独持久化版本行 ID。 | 后续真实审查需求确认后再扩展；当前不把 revision 等同于高保真 versionId。 |
| 固定 `0.0.1` 下旧实例 repair 未做真实数据库 smoke | 同版本 runner 现在会探测 `Upgrade.supportsSameVersionRepair`；合同 repair 使用 repair marker 和 advisory lock，一次执行并在事务中完成 schema、extension metadata 和 marker，缺少旧表/列/索引、重复 published 模板或 postcondition 不满足时 fail closed。 | 需要真实 PostgreSQL 旧 0.0.1 schema、已安装 marker、重复模板、并发启动和中途失败重试 smoke；当前未声明数据库升级闭环已验证。 |
| 上传审查 SSRF | fileId 优先走平台 storage stream；仅在受控 stream 不可用且平台记录为绝对 URL 时使用 `assertPublicHttpUrl()` + `downloadPublicHttpUrl()`；真实重定向到私网集成 smoke 尚未运行。 | P1 外部条件具备后执行危险 URL、重定向、带凭据和内网地址测试。 |
| 真实 Redis/Worker 未 smoke | 队列恢复、重复执行保护和超时补偿尚未声明生产闭环。 | 外部条件具备后覆盖入队失败、服务重启、超时任务、软删除和退款异常。 |
| 真实 LLM/文件存储未 smoke | 合同生成、审查、导出和退款不能声明完整联调。 | 需要测试 Secret、账号、余额、Redis/Worker、测试文件和主系统 URL。 |
| 导出记录仍在 task metadata | 多版本、多类型导出和审计追踪能力不足。 | P2 真实运营需求确认后增加最小导出记录。 |
| 私有原文预览能力缺失 | 无法安全提供 PDF/DOCX 页码和 Finding 证据跳转。 | P2 评估主系统受控 Open File Viewer/文件预览能力，不使用公共 Office Viewer。 |
| Web 主入口偏大 | 输入、Inspector 和状态编排仍集中在首页，可能继续产生 chunk warning。 | P1 先完成正确性，再按真实 bundle 证据拆分。 |
| 实时协作未实现 | 单用户可保存，但不支持双人实时编辑。 | P3 仅在 revision 冲突方案不足时评估 Yjs/Hocuspocus。 |

## P1 下一步

P1 代码与包级验证已完成；剩余工作只是真实环境交付验证和固定版本策略下的受控部署准备：

1. 在真实主系统测试账号、Secret、余额、Redis/Worker 和测试文件具备后，执行起草 → 编辑 → 保存 → 审查 → 采纳/忽略 → 再审查 → 恢复版本 → DOCX 导出的完整 smoke，并核对任务状态、revision、版本链、文件和账务事实。
2. 执行入队失败、Worker 重启、重复执行、stale、软删除回写、退款失败和 Console 排查字段 smoke；补危险 URL 重定向/DNS 重绑定到内网的真实拒绝测试。
3. 在真实嵌入式桌面宽度和移动宽度完成浏览器 QA，重点验证长合同滚动、section 定位、stale Finding、草稿冲突和导出反馈。
4. 固定 `0.0.1` 约束下，已安装实例的新增 schema 需要单独受控的一次性升级方案；本轮不通过改版本号绕过该边界。

不进入 P2 的确定性质量规则、导出审计和私有原文预览，也不进入 P3 的实时协作和高保真 DOCX。后续只有真实 smoke 或版本策略发生变化时才更新本 README。
