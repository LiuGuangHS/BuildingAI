# AI 图像工作台

`echoflow-image` 是 EchoFlow 的图像生成与编辑插件。用户端提供快速生成、参考图创作、无限画布整理和历史复用；Console 负责固定模型配置、模型级计费、风控、模板和全量历史。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 用户创作台 + 管理员运营配置台。 |
| 模型来源 | 固定图像模型 catalog，协议和 capability 由代码维护。 |
| 协议 | 支持 `responses`、`images`、`openai-compatible-images` 等请求合同。 |
| 画布 | `tldraw` 用作灵感白板、批注、拼贴、参考整理和导出，不承担节点式生成内核。 |
| 计费 | 模型级计费规则随模型配置维护；旧独立计费页退出默认路径。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 文生图 | ready | 按模型协议、默认参数、允许参数和模型级计费生成。 |
| 参考图生成 | ready | 支持平台 `fileId` 和经安全校验的 http(s) 参考图。 |
| 多协议 capability | ready | Responses 不暴露 mask，Images 不暴露图生图/mask/多参考图，OpenAI-compatible Images 的参考图和 mask 走 edits 能力。 |
| 模型接入点 | ready | 每个固定模型可绑定多组主站 Secret，支持优先级、超时、重试和 Base URL 覆盖。 |
| 模型级计费 | ready | 生成前预估和预扣，失败按模型规则退款。 |
| 风控策略 | ready | prompt 长度、张数、参考图、并发、每日额度等策略由 Console 维护。 |
| 模板预设 | ready | Web 可读取模板，Console 可管理模板。 |
| 无限画布 | ready | 白板草稿保存在本地浏览器，生成结果可整理到画布。 |
| 局部重绘 | reserved | 旧轻量遮罩画布已下线，后续并入完整画布工作流。 |
| 真实外部模型 smoke | pending | 需要真实 Secret 覆盖生成、失败退款和结果转存。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/echoflow-image/` | `src/web/pages/index.tsx` | 生成模式与无限画布工作台。 |
| Web | `/extension/echoflow-image/history` | `src/web/pages/history.tsx` | 当前用户生成历史。 |
| Web | `/extension/echoflow-image/history/:id` | `src/web/pages/detail.tsx` | 当前用户任务详情。 |
| Console | `/console/` | `src/web/pages/console/index.tsx` | 运营概览。 |
| Console | `/console/models` | `src/web/pages/console/models.tsx` | 固定模型、接入点、默认参数和模型级计费。 |
| Console | `/console/policies` | `src/web/pages/console/policies.tsx` | 风控限流。 |
| Console | `/console/templates` | `src/web/pages/console/templates.tsx` | 模板预设。 |
| Console | `/console/history` | `src/web/pages/console/history.tsx` | 全量生成历史。 |
| Console | `/console/history/:id` | `src/web/pages/console/detail.tsx` | 管理端任务详情与脱敏 raw 摘要。 |

路由由 `src/web/routes.tsx` 使用 `defineRouteOption()` 注册。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web generation | `@ExtensionWebController("generation")` | 创建生成、查询状态、历史详情和 public serializer。 |
| Web billing | `@ExtensionWebController("billing")` | 用户端费用预估。 |
| Web templates | `@ExtensionWebController("templates")` | 用户端模板读取。 |
| Web model-options | `@ExtensionWebController("model-options")` | 用户端可见模型与能力选项。 |
| Console generation | `@ExtensionConsoleController("generation")` | 全量历史和管理详情。 |
| Console model-configs | `@ExtensionConsoleController("model-configs")` | 固定模型配置、接入点、默认参数和能力收敛。 |
| Console billing-rules | `@ExtensionConsoleController("billing-rules")` | 模型计费规则。 |
| Console policies | `@ExtensionConsoleController("policies")` | 风控策略。 |
| Console templates | `@ExtensionConsoleController("templates")` | 模板管理。 |

关键服务：

| 服务 | 说明 |
|---|---|
| `GenerationService` | 请求幂等、余额预检、预扣、协议分发、状态写回、失败退款和结果序列化。 |
| `ModelConfigService` | 固定模型 catalog、接入点、用户可见性、默认参数和 capability 收敛。 |
| `image-model-catalog.ts` | 模型协议、能力和默认配置来源。 |
| `openai-image-client.ts` | Responses / Images / compatible Images 协议组装。 |
| `image-http-client.ts` | 参考图下载、重定向、DNS/SSRF 校验、大小截断和上游 HTTP 错误归一。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| Secret | 接入点复用主站 Secret；插件只保存 `secretId`、`secretName` 和运行参数。 |
| Provider Config | 通过 `normalizeProviderConfig()` 解析 `apiKey`、`baseURL` 等别名。 |
| Base URL | 接入点保存、测试和运行时复用 `@buildingai/extension-sdk` 的 `normalizePublicHttpUrl` / `assertPublicHttpUrl`，防止各插件重复维护公网校验。 |
| Billing | 使用 `ExtensionBillingModule` / `ExtensionBillingService` 做余额预检、预扣和失败退款。 |
| Upload | 参考图优先使用平台 `fileId`；外部 URL 默认需通过风控与 SSRF 校验。 |
| Notification | 通过 `ExtensionNotificationService` 注册图片生成成功、生成失败和崩溃超时失败场景；通知失败不回滚生成任务状态。 |
| HTTP | 上游请求和参考图下载使用插件内 `image-http-client.ts`，因为当前需要逐跳重定向校验、DNS 固定解析、私网拒绝和流式大小截断。 |
| UI | 生成表单、历史、模型、风控、模板和白板素材交互优先复用主系统组件。 |

如果主系统后续提供等价 SSRF-safe download 或 model gateway HTTP 能力，应整体迁移 `image-http-client.ts`，不要继续复制新工具函数。

## 数据与安全

| 主题 | 说明 |
|---|---|
| 用户端返回 | Web API 返回生成记录时剥离 `rawRequest`、`rawResponse`、`rawEvents` 和 `baseURL`。 |
| Console 详情 | 可保留脱敏 raw 摘要，用于排障。 |
| 接入点 | 不保存业务 API Key 明文或密文副本。 |
| Base URL 覆盖 | 保存时和运行时都拒绝本机、内网、保留地址、带凭据 URL 和非 http/https 协议；域名按 DNS 解析结果校验。 |
| 外部参考图 | 生产默认建议关闭外部 URL，优先平台上传 `fileId`。 |
| Provider 结果 | URL 不允许指向本机、内网、带凭据或非 http/https 协议。 |
| 删除保护 | 模型配置存在计费规则、策略、模板或生成历史引用时应停用而不是删除。 |
| 画布草稿 | `tldraw` 草稿保存在本地浏览器，不进入后端任务记录。 |

## 配置流程

1. 在主站密钥管理创建图像服务 Secret，字段包含 `apiKey` 或 `api_key`，可选 `baseURL` / `baseUrl` / `base_url`。
2. 在 Console `/models` 选择固定模型，绑定一组或多组 Secret 接入点。
3. 配置展示名、用户可见性、默认参数、允许参数、模型级计费、优先级、超时和重试。
4. 在 `/policies` 配置参考图、外部 URL、并发、prompt、每日额度等风控。
5. 在 `/templates` 维护用户端可选模板。

## 开发与验证

```bash
pnpm --filter echoflow-image check-types
pnpm --filter echoflow-image build:api
pnpm --filter echoflow-image build:web
pnpm --filter echoflow-image build:publish
```

`build:web` 通过 `scripts/build-web.mjs` 执行，用于绕过当前环境中 Vite/Rolldown 配置加载和 HTML entry 解析问题；修改构建链路时需重新做最小 HTML smoke 和插件真实构建。

当前验证缺口：

| 项目 | 状态 |
|---|---|
| 单测 | 当前 package 未定义 `test` 脚本；需要补失败退款、capability 收敛、URL 安全和 public serializer 测试。 |
| 真实模型 smoke | 需要真实 Secret 覆盖 Responses、Images、compatible Images 的成功、失败、退款和结果转存。 |
| Web 构建 | 需在当前 Node 22 / pnpm 10 环境重新确认 `scripts/build-web.mjs` 路径稳定。 |

## 已知风险

| 风险 | 影响 | 下一步 |
|---|---|---|
| 外部 URL 下载安全 | 参考图和结果 URL 处理复杂，不能用裸 fetch 替代。 | 保持 `image-http-client.ts` 集中封装，补 SSRF 和重定向测试。 |
| capability 漂移 | Console 配置若覆盖协议能力会误导用户端。 | 能力矩阵继续由 catalog 和协议适配层反推。 |
| 局部重绘未上线 | 用户可能误以为 mask 已可用。 | 保持 reserved，不在用户端暴露未实现能力。 |
| 真实供应商未 smoke | 不能声明外部模型闭环完成。 | 准备 Secret、余额、存储和测试图后逐协议验证。 |

## 下一步

| 优先级 | 任务 |
|---|---|
| P1 | 真实模型端到端 smoke：文生图、参考图、失败退款和结果转存。 |
| P1 | 补 URL 安全、capability 收敛、失败退款和 public serializer focused tests。 |
| P1 | 复核 `build:web` / `build:publish`，确认自定义 build 脚本仍必要且稳定。 |
| P2 | 将画布能力继续限定为灵感白板，后续编辑/局部重绘进入完整画布工作流前先补协议和计费边界。 |
| P2 | 若主系统提供安全下载或模型网关 HTTP SDK，迁移并删除插件内重复底层 HTTP 能力。 |
