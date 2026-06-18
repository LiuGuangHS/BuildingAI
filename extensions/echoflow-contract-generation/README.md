# AI 合同生成

`echoflow-contract-generation` 是 EchoFlow 的 AI 合同起草与审查插件，面向企业法务、创业者和个人用户，提供多行业模板、AI 起草、上传合同审查、条款改写、风险提示、版本恢复和 Word 导出。

## 功能范围

- 用户端直接展示合同工作台，不做营销落地页。
- 用户端采用三栏合同工作台：左侧模板与最近合同，中间起草/审查、条款编辑和操作区，右侧风险评分、风险建议、法律术语与版本历史。
- 支持合同模板选择、字段填写、AI 生成、在线编辑、风险建议采纳/忽略、历史任务查看。
- 支持上传已有合同进行审查，输出条款结构、风险点、法律术语解释和评分。
- 支持合同版本记录、版本恢复和 `.docx` 导出。
- 用户端当前任务详情会按任务 ID 独立轮询，不依赖最近合同列表第一页，避免后台生成完成后页面不刷新。
- Console 管理端支持固定 LLM 模型配置、合同模板 CRUD、内置模板重置、任务后端筛选分页、任务查看和删除。

## 配置

- 管理员需要在 Console 的模型配置页选择一个启用的 LLM 模型。
- Console 只展示启用的 LLM 模型和启用的 Provider；保存配置时后端会再次校验模型可用性。
- Console 模型配置页展示当前模型 Provider、模型 ID 和 `pricePerContract`，价格来源仍为平台模型配置。
- 模型 Provider 的 API Key、Base URL 等敏感配置走平台密钥配置，不写入源码、`manifest.json`、前端包或 `.env`。
- 上传合同审查只接受当前插件通过平台上传返回的 `fileId`；服务端会校验上传者、`extensionIdentifier === "echoflow-contract-generation"`、文件类型和 20MB 大小上限，并拒绝本机、内网或带凭证的文件 URL。

## 计费

- 当前生成、上传审查等 AI 调用费用来自所选模型的 `modelConfig.pricePerContract`，没有配置时默认为 0。
- 扣费使用 `ExtensionBillingService.deductUserPower()`，并用任务 ID 作为 `associationNo` 避免重复扣费。
- 生成前做余额预检；任务入库后预扣额度，AI 失败时按任务记录自动退款，退款失败会写入 `providerMetadata.refundError` 便于排查。

## 数据与存储

- 插件实体使用 `@ExtensionEntity()`，表位于插件独立 schema。
- 业务实体包括合同任务、任务版本、合同模板和插件配置。
- 内置合同模板在首次访问模板管理或用户模板列表时同步到插件表；同步时由数据库生成模板 UUID 主键，不把内置模板的字符串 ID 写入 UUID 主键列；已软删除的内置模板不会被普通列表自动复活。
- 运行时导出的 Word 文件通过平台上传能力保存，业务记录只保存 URL。
- 生成、审查、导出等处理中的任务禁止删除；审查/导出开始前会加锁抢占任务状态，长流程写回前会再次检查任务是否已软删除，避免已删除记录被后台流程继续更新。
- 用户端标题、摘要和条款编辑通过 `PATCH /tasks/:id/content` 保存，保存内容以当前工作台输入状态为准。
- 发布随包携带静态图标：`storage/static/icon.png`。
- Windows + pnpm 本地构建沿用插件 Vite alias 解析 `react-router-dom`、`react-router`、`radix-ui`、`zustand` 和 `@buildingai/utils`，避免发布构建时 Rolldown 无法解析工作区依赖。

## 种子数据

当前插件不使用独立 seed 文件。内置合同模板由 `ContractGenerationService.syncBuiltinTemplatesIfMissing()` 在运行时幂等同步，并按合同类型和模板名称去重；后续如果模板量增加或需要安装期初始化，应迁移到 `src/api/db/seeds` 并导出 `getSeeders()`。

## Migration 与 Upgrade

- 当前纳入版本为 `0.0.1`，已提交首版插件 migration：`src/api/db/migrations/1781539200001-0.0.1-init-contract-generation.ts`。
- 首版 migration 覆盖合同任务、任务版本、合同模板和配置表；安装联调时需验证 migration 在目标数据库执行成功。
- 首版 Upgrade：`src/api/upgrade/0.0.1/index.ts` 会幂等写入主系统 `extension` 安装记录，确保本地插件启用后用户端和 Console 的扩展详情接口能识别该插件。
- 版本升级涉及字段变更时，先提升 `package.json.version` 与 `manifest.json.version`，再补 migration 或 `src/api/upgrade/<version>/index.ts`。
- 当前逻辑未变更表结构，`0.0.1` 版本内的文件归属校验、模板选择校验、内置模板同步、处理中保护和 Vite alias 修复不需要新增 migration；安装记录通过首版 Upgrade 收口。

## 质量门禁

纳入后至少执行：

- `pnpm --filter echoflow-contract-generation check-types`
- `pnpm --filter echoflow-contract-generation build:api`
- `pnpm --filter echoflow-contract-generation build:web`
- `pnpm --filter echoflow-contract-generation build:publish`

发布前再执行：

- `pnpm --filter echoflow-contract-generation build:publish`
- 用户端页面 smoke test：模板加载、示例填充、生成任务、任务详情轮询、标题保存、风险审查、导出按钮状态。
- Console 页面 smoke test：模型价格展示、模板列表与保存、任务后端筛选分页。

## 后续待办

- 为合同生成、上传审查、文件归属校验和 DOCX 构建补 focused unit tests。
- 将上传合同审查的 `fileId` 流程联调到真实部署域名。
- 梳理合同免责声明和合规提示文案，确保用户明确知道输出不构成正式法律意见。

## 后端业务逻辑审查（2026-06-15）

### 模块拆解

| 模块 | 当前逻辑 | 黑盒/隐含规则 |
|------|----------|---------------|
| Config | 维护单条 `key=default` 插件配置，固定选择一个启用 LLM 模型。 | 首次并发创建配置会捕获唯一键冲突并回读既有配置；合同成本读取 `AiModel.modelConfig.pricePerContract`，没有配置时为 0。 |
| Template | 内置模板缺失时用户端和 Console 均会同步内置模板；Console 可 CRUD、重置内置模板；用户生成时选择模板字段。 | 生成只看启用 DB 模板；未传模板 ID 时默认第一条启用模板，传入模板 ID 无效时明确报错；创建/更新模板时会校验字段、默认条款和同类型同名冲突。 |
| Generate | 创建任务、余额预检、任务入库后通过主系统 `QueueModule` 的 BullMQ/Redis 基础设施异步调用 LLM，完成后写入合同草稿和版本。 | 插件只注册 `echoflow-contract-generation-task` 业务队列；队列不可用时保留本地 fallback，执行前用任务锁避免重复生成。 |
| Review | 校验平台 `fileId`、上传者、插件归属、大小和文件类型后创建审查任务，再通过同一业务队列解析合同并调用 LLM 输出结构化审查结果。 | 上传审查按任务成本预扣；已生成任务的再次审查、条款改写当前按“生成后免费”策略处理。 |
| Version | 编辑、恢复、审查和导出都会写版本记录，最新版本号通过任务行锁递增。 | 版本号有 `(taskId, versionNo)` 数据库唯一索引，并在冲突时做一次重试。 |
| Export | 处理中的任务禁止导出/删除，导出时先加锁切换到 `exporting`，再生成 `.docx` 并通过平台上传能力保存 URL。 | 导出也是同步请求内执行，失败后进入 `export_failed` 并记录错误，方便用户重试和管理员排查。 |
| Billing | 以任务 ID 为 `associationNo`，扣费和退款都在事务内加锁，并检查业务状态与 `AccountLog`。 | 退款失败会写入 `providerMetadata.refundError`，方便补偿和排查。 |

### 问题与修复规划

| 优先级 | 模块 | 问题 | 影响 | 修复规划 |
|--------|------|------|------|----------|
| P1 | Review / Rewrite | `reviewTask()` 与 `rewriteClause()` 目前采用“生成后免费”策略，但以前未在代码和文档里写死。 | 用户和管理员都容易误判是否收费。 | 保持默认免费，并在后续若要收费时改成显式配置 + 账务幂等。 |
| P2 | Template | 普通删除未检查历史任务引用，重置内置模板会软删除旧内置模板并重建。 | 历史任务的 `templateId` 可能指向已软删除模板，只能依赖快照字段。 | 已有任务引用的模板改为停用或版本化；任务保留模板快照并在详情页优先展示快照。 |
| 已修复 | Generate / Upload Review | 新建合同和上传审查已接入主系统 `QueueModule`，接口只创建任务并由前端轮询状态。 | 大模型和文件解析不再阻塞 HTTP 请求；发布前仍需真实 Redis/Worker smoke。 | 后续如果主系统 `QueueService` 支持动态队列，再收敛到统一 enqueue API。 |
| P2 | Review / Rewrite / Export | 再次审查、条款改写和导出仍在请求内同步执行。 | 大模型或 DOCX 构建耗时高时，仍可能请求超时。 | 视使用频率继续迁移到队列；导出优先改为异步任务或平台文件导出 job。 |
| P2 | Config / Billing | `pricePerContract` 藏在平台模型配置中，默认 0。 | 管理员可能以为已启用收费但实际免费。 | Console 显示当前模型价格来源；插件配置页增加合同生成、审查、改写的显式价格。 |
| P3 | Version | 版本号已增加数据库唯一兜底和冲突重试。 | 极端并发下仍可能因为重试次数有限而失败。 | 若出现高并发编辑场景，再增加任务级操作队列或更细的重试策略。 |

### 已确认较好的边界

- 指定 `templateId` 不存在或已停用时会明确报错，不会静默切到其他合同模板。
- 新建/更新模板时会校验至少一个有效字段、至少一个默认条款，并阻止同合同类型下的同名模板。
- 内置模板同步会剥离内置字符串 ID，避免写入 UUID 主键时报错。
- 内置模板从未同步或缺失时会自动同步，即使管理员已经先创建过自定义模板，也不会导致内置模板永远缺席；已软删除的内置模板只会在“重置内置模板”时重建。
- 用户端模板列表也会触发内置模板同步，避免用户先看到内存字符串 ID、生成时又切换到 DB UUID 的不一致。
- 默认配置通过 `key=default` 唯一约束保持单例，首次并发访问会捕获唯一键冲突并回读既有配置。
- 上传合同审查已校验当前用户、插件归属、类型、20MB 大小上限和文件 URL 安全边界。
- 生成、审查、条款改写、导出和删除都对处理中状态有保护；审查/导出入口先用任务行锁抢占状态，避免后台流程写回已软删除记录。
- 采纳风险建议时会校验条款非空，避免把合同正文更新为空数组。
- 版本记录已用 `(taskId, versionNo)` 唯一索引兜底，服务层遇到唯一冲突会重新读取最新版本号后重试一次。
- 扣费和退款 helper 已使用任务锁、`associationNo`、业务状态和 `AccountLog` 二次幂等检查。
