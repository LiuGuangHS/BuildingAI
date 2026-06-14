# AI 合同生成

`echoflow-contract-generation` 是 EchoFlow 的 AI 合同起草与审查插件，面向企业法务、创业者和个人用户，提供多行业模板、AI 起草、上传合同审查、条款改写、风险提示、版本恢复和 Word 导出。

## 功能范围

- 用户端直接展示合同工作台，不做营销落地页。
- 支持合同模板选择、字段填写、AI 生成、在线编辑、风险建议采纳/忽略、历史任务查看。
- 支持上传已有合同进行审查，输出条款结构、风险点、法律术语解释和评分。
- 支持合同版本记录、版本恢复和 `.docx` 导出。
- Console 管理端支持固定 LLM 模型配置、合同模板 CRUD、内置模板重置、任务查看和删除。

## 配置

- 管理员需要在 Console 的模型配置页选择一个启用的 LLM 模型。
- Console 只展示启用的 LLM 模型和启用的 Provider；保存配置时后端会再次校验模型可用性。
- 模型 Provider 的 API Key、Base URL 等敏感配置走平台密钥配置，不写入源码、`manifest.json`、前端包或 `.env`。
- 上传合同审查只接受平台上传返回的 `fileId`；服务端会校验上传者、插件归属、文件类型和 20MB 大小上限。

## 计费

- 当前生成、上传审查等 AI 调用费用来自所选模型的 `modelConfig.pricePerContract`，没有配置时默认为 0。
- 扣费使用 `ExtensionBillingService.deductUserPower()`，并用任务 ID 作为 `associationNo` 避免重复扣费。
- 生成前做余额预检；任务入库后预扣额度，AI 失败时按任务记录自动退款，退款失败会写入 `providerMetadata.refundError` 便于排查。

## 数据与存储

- 插件实体使用 `@ExtensionEntity()`，表位于插件独立 schema。
- 业务实体包括合同任务、任务版本、合同模板和插件配置。
- 内置合同模板在首次访问模板管理或用户模板列表时同步到插件表。
- 运行时导出的 Word 文件通过平台上传能力保存，业务记录只保存 URL。
- 生成、审查、导出等处理中的任务禁止删除；异步写回前会检查任务是否已软删除，避免已删除记录被后台流程继续更新。
- 发布随包携带静态图标：`storage/static/icon.png`。

## 种子数据

当前插件不使用独立 seed 文件。内置合同模板由 `ContractGenerationService.syncBuiltinTemplatesIfEmpty()` 在运行时幂等同步；后续如果模板量增加或需要安装期初始化，应迁移到 `src/api/db/seeds` 并导出 `getSeeders()`。

## Migration 与 Upgrade

- 当前纳入版本为 `0.0.1`，已提交首版插件 migration：`src/api/db/migrations/1781539200001-0.0.1-init-contract-generation.ts`。
- 首版 migration 覆盖合同任务、任务版本、合同模板和配置表；安装联调时需验证 migration 在目标数据库执行成功。
- 版本升级涉及字段变更时，先提升 `package.json.version` 与 `manifest.json.version`，再补 migration 或 `src/api/upgrade/<version>/index.ts`。

## 质量门禁

纳入后至少执行：

- `pnpm --filter echoflow-contract-generation check-types`
- `pnpm --filter echoflow-contract-generation build:api`
- `pnpm --filter echoflow-contract-generation build:web`

发布前再执行：

- `pnpm --filter echoflow-contract-generation build:publish`
- 用户端页面 smoke test：模板加载、生成任务、任务详情、导出按钮状态。
- Console 页面 smoke test：模型配置、模板列表、任务列表。

## 后续待办

- 为合同生成、上传审查、文件归属校验和 DOCX 构建补 focused unit tests。
- 将上传合同审查的 `fileId` 流程联调到真实部署域名。
- 梳理合同免责声明和合规提示文案，确保用户明确知道输出不构成正式法律意见。
