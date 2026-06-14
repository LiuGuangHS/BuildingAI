# AI 星盘运势

`echoflow-astrology-fortune` 是 EchoFlow 的 AI 星盘与运势报告插件，基于出生信息、星座生肖、长期档案和用户问题生成每日运势、性格洞察、情感配对、事业财富与生活决策建议。

## 功能范围

- 用户端直接展示星盘运势工作台。
- 支持创建个人档案、更新档案、删除档案和查看档案列表。
- 支持生成每日运势、性格报告、关系配对和决策建议。
- 支持报告列表、报告详情、收藏和删除。
- Console 管理端支持默认 LLM 模型配置、不同报告类型定价、报告列表、档案列表和报告删除。

## 配置

- 管理员需要在 Console 配置默认 LLM 模型。
- Console 只展示启用的 LLM 模型和启用的 Provider；保存配置时后端会再次校验模型可用性。
- 模型列表会返回 `providerName` 和 Provider 对象，前端展示必须与接口字段保持一致。
- 模型 Provider 的 API Key、Base URL 等敏感配置走平台密钥配置，不写入源码、`manifest.json`、前端包或 `.env`。
- 用户侧不暴露模型选择，仅显示生成与报告结果。

## 计费

- 插件按报告类型读取后台配置价格：每日、普通报告、配对、决策。
- 生成前使用 `ExtensionBillingService.hasSufficientPower()` 做余额预检。
- 报告入库后预扣额度，使用报告 ID 作为 `associationNo` 避免重复扣费。
- AI 失败时报告标记为 `failed` 并自动退款，退款失败会写入 `providerMetadata.refundError` 便于排查。

## 数据与存储

- 插件实体使用 `@ExtensionEntity()`，表位于插件独立 schema。
- 业务实体包括星盘档案、运势报告和插件设置。
- 不存储真实密钥；模型和 Provider 信息只保存平台模型 ID 与 Provider ID。

## 种子数据

当前插件不需要初始化种子数据。首次访问设置时会幂等创建默认设置记录。

## Migration 与 Upgrade

- 当前纳入版本为 `0.0.1`，已提交首版插件 migration：`src/api/db/migrations/1781539200002-0.0.1-init-astrology-fortune.ts`。
- 首版 migration 覆盖档案、报告和设置表；安装联调时需验证 migration 在目标数据库执行成功。
- 后续字段变更时提升 `package.json.version` 与 `manifest.json.version`，并补充 migration 或 `src/api/upgrade/<version>/index.ts`。

## 质量门禁

- `pnpm --filter echoflow-astrology-fortune check-types`
- `pnpm --filter echoflow-astrology-fortune build:api`
- `pnpm --filter echoflow-astrology-fortune build:web`

## 后续待办

- 为报告生成、计费幂等、超时任务回收补 focused unit tests。
- 增加报告内容安全提示，避免绝对化预测、医疗、法律或投资保证。
