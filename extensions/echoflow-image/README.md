# AI图像工作台

面向创作者的 BuildingAI AI 图像生成与编辑插件。基于 OpenAI-compatible Images API，支持 Web 用户端与 Console 管理端的文生图、参考图创作、历史保存、算力计费、结果预览和完整的生成记录管理。

## 功能特性

- **OpenAI 兼容**：对接任何 OpenAI-compatible Images API（Echoflow、DALL·E 等），通过 baseURL 切换服务
- **文生图**：输入 prompt，选择模型和参数（尺寸、数量、质量、风格），一键生成图片
- **双入口**：Web 用户端直接提供绘画工作台，Console 管理端提供运营概览、模型配置、计费策略、风控限流、模板预设和全量历史
- **参考图生成**：支持启用图生图能力的模型使用服务端可访问的 http(s) 参考图或平台 `fileId`，并支持 mask 局部重绘
- **提示词模板**：管理员可发布全站模板，用户端可一键套用
- **配置化计费**：生成前按插件计费规则预估与扣费，生成失败按计费规则决定是否退款，billingStatus 独立追踪
- **幂等防重**：前端每次生成携带 requestKey，后端按 userId + requestKey 去重
- **生成历史**：列表、搜索、状态筛选、分页、详情、删除、重试全闭环
- **结果管理**：预览、原图打开、单张下载、批量下载、revised prompt 展示
- **安全防护**：外部参考图 URL 做协议、DNS、私网网段和重定向校验；生成任务采用数据库条件抢占，避免并发重复执行

## 架构

```
extensions/echoflow-image/
├── manifest.json              # 插件清单
├── package.json               # 依赖与构建脚本
├── src/
│   ├── api/                   # 后端 NestJS
│   │   ├── db/entities/       # ImageGeneration 实体
│   │   └── modules/generation/
│   │       ├── controllers/   # Web / Console controllers
│   │       ├── dto/           # 请求校验
│   │       └── services/      # 业务逻辑 + OpenAI client
│   └── web/                   # 前端 React
│       ├── components/        # UI 组件
│       ├── pages/             # Web 创作台 / 历史 / 详情
│       ├── pages/console/     # Console 创作台 / 历史 / 详情
│       ├── services/          # React Query hooks
│       └── types/             # TypeScript 类型
```

## 产品边界

`echoflow-image` 的定位是“用户创作台 + 管理员运营配置台”，不在插件内重复实现主系统模型密钥管理，也不通过 patch 主系统绕过插件体系。

### 用户端

访问路径：`/extension/echoflow-image/`

用户端直接展示绘画工作台，能力包括：

- 文生图、单参考图图生图、多参考图、平台 `fileId` 参考图、Responses API 和 mask 局部重绘
- 当前用户历史、详情、删除和重试
- 结果预览、下载、复制参数再生成
- 模板套用、参数选择和生成前算力预估

用户端不展示供应商密钥、全局计费配置、其他用户记录或未脱敏的上游响应。

### 管理端

访问路径：`/extension/echoflow-image/console/`

Console 负责运营配置和全站管理：

- 模型启用、能力矩阵、默认参数和允许参数
- 计费规则、风控限流、模板预设
- 全量生成历史、详情、失败原因和账务状态
- 测试工具、配置健康检查和运营概览

## 参考与许可

`.agents/references/Image-Studio` 可作为产品能力参考，重点参考 Images API 调用、Responses 流式思路、参数组织、多图参考、mask、prompt history、模板、画布和批量能力。

Image Studio 使用 AGPL-3.0-only 许可，因此只做能力分析和交互参考，不复制代码、样式、文案或资源到本插件。需要落地的能力应按 BuildingAI 插件规范重新实现。

## 安装与配置

### 1. 安装插件

插件随仓库一同部署，确保 `extensions/echoflow-image/` 目录存在即可。启动后插件会自动注册。

### 2. 配置主站密钥

先在 BuildingAI 主系统后台 → 密钥管理中创建可用 Secret。Secret 字段建议包含：

| 字段 | 说明 | 示例 |
|------|------|------|
| apiKey / api_key | 服务商密钥 | `sk-xxx` |
| baseURL / baseUrl / base_url | OpenAI-compatible 端点 | `https://api.openai.com/v1` |

### 3. 配置固定绘画模型

插件 Console → 模型配置 使用插件内置固定模型目录。管理员只需要为模型绑定一组或多组主站 Secret，并按需调整展示名、默认参数、允许参数和计费规则。

可配置项包括：

- 展示名称、排序、启用状态、用户可见性
- 请求协议：`responses` / `images` / `openai-compatible-images`
- 接入点：主站 Secret、可选 Base URL 覆盖、优先级、超时和重试
- 能力矩阵：文生图、图生图、多参考图、negative prompt、输出格式等
- 默认参数、允许参数和模型级计费

> **注意**：插件不保存业务 API Key 明文，也不新增供应商配置；密钥统一复用主站密钥管理。

### 4. 配置计费、风控与模板

在插件 Console 中继续配置：

- 计费策略：全局默认规则或模型级规则，按模式、尺寸、质量、数量计算算力
- 风控限流：prompt 长度、单次张数、参考图、并发和每日额度
- 模板预设：发布给用户端使用的 prompt 模板和默认参数

### 5. 用户算力

确保用户账户有足够算力余额，生成前会检查，不足时拒绝生成。

## API 接口

Web 接口挂载在 `/echoflow-image/api/` 下，Console 接口挂载在 `/echoflow-image/consoleapi/` 下，均需登录态。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/generation` | 创建并执行生成 |
| GET | `/generation` | 分页查询当前用户历史 |
| GET | `/model-options` | 获取插件启用的可用图片模型列表 |
| POST | `/billing/estimate` | 预估本次生成算力消耗 |
| GET | `/templates` | 获取启用模板 |
| GET | `/generation/:id` | 查询单条详情 |
| DELETE | `/generation/:id` | 删除记录 |
| POST | `/generation/:id/retry` | 按原参数重新生成 |

### 创建生成请求体

```json
{
  "prompt": "赛博朋克风格的未来城市",
  "modelId": "<main-system-ai-model-uuid>",
  "size": "1024x1024",
  "n": 1,
  "quality": "standard",
  "style": "vivid",
  "responseFormat": "b64_json",
  "requestKey": "<uuid-v4>"
}
```

| 字段 | 必填 | 约束 |
|------|------|------|
| prompt | ✅ | 1-4000 字符 |
| modelId | ✅ | 主系统 `text-to-image` 模型 UUID；插件模型覆盖只通过后端自动匹配，不要求用户端传覆盖配置 ID |
| size | ❌ | `1024x1024` / `1024x1792` / `1792x1024` |
| n | ❌ | 1-4，DALL·E 3 类强制 1 |
| quality | ❌ | `standard` / `hd` |
| style | ❌ | `vivid` / `natural` |
| responseFormat | ❌ | `b64_json` / `url` |
| requestKey | ❌ | UUID v4，重复即幂等返回已有记录 |

用户端会按模型能力矩阵裁剪请求参数：未启用图生图时不提交参考图，未启用 mask 时不提交遮罩图，未启用反向提示词时不提交 negative prompt。可选 UUID 字段的空字符串会在后端归一化为未传，避免空值进入 UUID 查询或校验路径。

## 计费规则

计费规则在插件 Console → 计费策略中配置，支持全局默认规则和模型级规则。实际扣费按归一化后的生成参数计算，确保默认尺寸、默认质量、默认张数和实际落库参数一致。

主系统算力账本是整数契约。插件内可以用基础费用、倍率、尺寸和张数计算中间值，但传给 `ExtensionBillingService.hasSufficientPower()`、`deductUserPower()`、`addUserPower()` 的最终金额会按正数向上取整，避免把小数或 decimal 字符串写入主系统 `account_log`。

默认规则为：

| 条件 | 系数 |
|------|------|
| 基础 | `1 × n` |
| quality=hd | ×2 |
| 宽或高 > 1024 | ×2 |

> 示例：2 张 1792x1024 HD 图片 = `2 × 2 × 2 = 8` 算力。失败后是否退款由 `refundOnFailure` 控制。

## 安全与运行约束

- 外部参考图 URL 只允许 `http(s)`，禁止认证信息、localhost、内网、链路本地、保留网段和重定向到不安全地址。
- 下载外部参考图时会绑定已校验 IP，避免 DNS rebinding 在校验和请求之间绕过网段检查。
- 生产环境建议默认关闭“允许外部参考图 URL”，优先使用平台文件上传 `fileId`。
- `PENDING` 任务进入执行前会通过数据库条件更新抢占，抢占失败不会重复扣费或重复请求上游。
- `PENDING` / `PROCESSING` 任务不允许删除，避免后台任务继续写回导致历史和账务不一致。
- 删除模型配置前会检查计费规则、风控策略和生成历史引用；已有引用时应停用模型，而不是删除。

## 开发

```bash
# 安装依赖
pnpm install --filter echoflow-image

# API 开发模式
pnpm --dir extensions/echoflow-image dev:api

# Web 开发模式
pnpm --dir extensions/echoflow-image dev:web

# 同时启动
pnpm --dir extensions/echoflow-image dev

# 构建
pnpm --dir extensions/echoflow-image build:api
pnpm --dir extensions/echoflow-image build:web

# 发布构建
pnpm --dir extensions/echoflow-image build:publish
```

## 质量门禁

静态门禁仅限定在 `extensions/echoflow-image`：

```bash
pnpm --dir extensions/echoflow-image lint
pnpm --dir extensions/echoflow-image check-types
pnpm --dir extensions/echoflow-image build:api
pnpm --dir extensions/echoflow-image build:web
pnpm --dir extensions/echoflow-image build:publish
```

运行时 smoke 建议覆盖：

- `GET /extension/echoflow-image/` 返回插件 HTML。
- 插件 HTML 引用的 JS 和 CSS 分别返回 `text/javascript` 与 `text/css`。
- `GET /extension/echoflow-image/console/` 返回 Console 插件 HTML。
- `GET /echoflow-image/api/model-options` 未登录返回 `401`，登录后返回 JSON 模型列表。
- `POST /echoflow-image/api/billing/estimate` 按模型、模式、尺寸、质量和数量校验并估算费用。
- `POST /echoflow-image/api/generation` 创建生成记录，扣费，并按计费规则在失败时退款或保留扣费。
- Web 历史只返回当前用户记录，Console 历史可查看全量记录和详情。
- Retry 使用原参数创建新的生成记录，不复用旧 requestKey。
- 升级脚本在已升级数据库上重复执行应保持幂等。

当前残留：

- 真实服务商 smoke 需要可用图片模型 API Key、存储配置和有足够算力的登录用户。
- BullMQ 业务队列已接入，但多节点部署仍需要验证 worker 数量、Redis 配置和 fallback 路径。
- 首版发布安装还未做完整 smoke，需要验证 release 包、Upgrade 幂等和页面可打开。
- Web 构建存在 chunk 体积 warning，后续可做路由级动态拆包。

## 种子数据

当前插件不需要初始化种子数据。

如果后续需要内置风格预设、提示词模板或示例作品，可以在插件内新增 `src/api/db/seeds/index.ts`，并按 BuildingAI 插件种子机制导出 `getSeeders()`。

## 路线图

- [x] Text-to-image MVP
- [x] Web / Console 双入口与双 HTTP Client
- [x] Console 模型配置 / 计费策略 / 风控限流 / 模板预设骨架
- [x] Web 模型列表改为读取插件启用配置
- [x] 生成流程接入模型配置、参数能力校验、计费规则和风控策略
- [x] 账务一致性（billingStatus 独立追踪）
- [x] 幂等防重复（requestKey）
- [x] OpenAI Client 增强（timeout / 重试 / 错误分类）
- [x] 供应商错误脱敏与结果 URL 协议白名单
- [x] b64_json 结果转存插件存储
- [x] Image-to-image 平台 `fileId` 闭环和 mask 局部重绘
- [x] 插件内异步任务、状态轮询、失败重试和退款补偿
- [x] Negative prompt 拼接至 provider prompt
- [x] Prompt 本地润色、历史复用、批量生成数量控制
- [x] 轻量遮罩画布与参考图管理
- [x] Responses API 专用调用适配
- [x] 多参考图编辑扩展
- [x] 任务恢复扫描和 Console 手动恢复
- [x] Prompt AI 改写接口（失败时回退本地润色）

### 后续待办任务

| 优先级 | 任务 | 说明 |
|--------|------|------|
| P1 | 真实服务商 smoke | 准备测试模型、API Key、插件存储、测试用户和算力余额，覆盖文生图、图生图、mask、失败退款和结果转存 |
| P1 | 安装与浏览器 smoke | 已通过 `build:publish` 和关键产物检查；待全站启动恢复后继续验证插件安装、Upgrade 幂等、插件登记、storage 保留和 Web / Console 页面可打开 |
| P1 | 队列多节点 smoke | 验证已接入的 BullMQ 业务队列在多节点部署下的 worker 数量、Redis 配置和本地 fallback 行为 |
| P1 | 存储路径收敛 | 当前结果图转存会定位插件目录后写入 `storage/uploads`；后续优先改为插件配置或主系统 SDK 提供的存储路径能力 |
| P2 | 计费 / 风控规则唯一性 | 为全局 / 模型级启用规则增加唯一约束或显式 `priority`，并在 Console 展示最终命中规则 |
| P2 | 并发与每日额度事务化 | 当前额度是提交前快照；后续在创建事务内占用额度，必要时接主系统 Redis/Cache 计数器 |
| P2 | 任务取消能力 | 为 `PENDING` / `PROCESSING` 增加 cancel 状态、取消按钮和上游中断策略，避免只能等待完成或失败后删除 |
| P2 | 模型级风控 UI | 后端已支持模型级策略，Console 需要补模型级风控配置入口和继承全局规则的展示 |
| P3 | 模板默认参数落地 | 模板实体已有 `defaultParams`，用户端可进一步一键套用尺寸、质量、风格、参考图模式等参数 |
| P3 | 管理端表单增强 | 计费倍率、尺寸、质量、风格、能力矩阵从自由文本升级为结构化编辑器和即时校验 |
| P3 | 前端路由级拆包 | 对 Web / Console 页面、图标库和管理页按路由动态加载，消除 Vite 大 chunk warning |
| P4 | 完整画布工作流 | 补充多图图层、遮罩编辑历史、撤销 / 重做、局部重绘前后对比和批量版本管理 |

### 数据与模块现状

- `ImageModelConfig`：已用于插件启用模型、展示名称、能力矩阵、默认参数和排序。
- `ImageBillingRule`：已支持全局或模型级计费规则，生成前预估、扣费和失败退款共用同一规则。
- `ImagePolicyConfig`：已支持 prompt 长度、单次张数、参考图、并发和每日额度等风控配置。
- `ImagePromptTemplate`：已支持管理员发布，用户端只读使用。
- `ImageGeneration`：已保存模型 / 计费 / 策略快照、requestKey、rawRequest / rawResponse 摘要和失败分类。

后端模块保持 Config、Billing、Policy、Template、Generation 拆分；Web 与 Console 的 HTTP client、hooks、页面和权限边界继续分离。

## 后端业务逻辑审查（2026-06-15）

### 本轮已修复

| 模块 | 修复点 | 当前状态 |
|------|--------|----------|
| Reference Image | 平台 `fileId` / mask 读取前校验 File 记录、上传者、`extensionIdentifier === "echoflow-image"`、MIME 和大小，并从插件上传目录读流。 | 已避免拿到他人文件 ID 后作为参考图或 mask 传给上游。 |
| Billing | 生成扣费和失败退款改为 `pessimistic_write` 锁 + `AccountLog associationNo` 检查 + 业务状态事务保存。 | 恢复扫描、后台失败和重复执行入口不会重复扣费或重复退款。 |
| Billing | 插件估算、扣费和退款入口统一把最终算力金额归一化为整数，再调用主系统 `ExtensionBillingService`。 | 避免主系统整数账本收到 `1.00` 或小数金额导致扣费失败。 |
| Request DTO | 生成、估算、查询、prompt 润色和 Console 配置中的可选 UUID 字段会把空字符串归一化为未传。 | 避免 `invalid input syntax for type uuid: ""` 这类空 UUID 进入数据库路径。 |
| Web Form | 用户端生成和估算共用有效 payload 构造，并按当前模型 capability 剔除图生图、mask 和反向提示词等不支持参数。 | 避免 UI 残留状态触发“该模型未启用输出格式参数 / 局部重绘能力”等误报。 |
| Policy | 外部参考图 URL 默认关闭；显式开启时也会拒绝本机、内网、凭证 URL；平台上传必须提交 `fileId`。 | 管理员可受控开放公开 URL，同时默认优先平台上传链路。 |
| Model Config | 创建/更新图片模型配置、Console 可选模型列表、用户端读取模型配置时都复核主系统模型已启用、Provider 已启用，并具备图片模型特征。 | 避免保存、展示或调用生成时不可用的图片模型配置。 |
| Storage | b64 结果图转存时会从当前模块路径或 cwd 向上查找 `echoflow-image` 插件根目录，再写入 `storage/uploads`。 | 避免因为进程启动目录不同，把结果图写到错误路径。 |
| Main System Reuse | 生成模块改为导入 `AiPublicModule` 与 `ExtensionBillingModule`，由 SDK 提供 AI 模型服务和插件扣费服务。 | 减少插件手动注册主系统 Service 和实体，保持插件只维护自身业务实体。 |
| Billing / Policy | 计费规则和模型级风控保存前会校验插件模型覆盖配置存在，首版 Upgrade 会清理已存在的孤儿模型级规则。 | 避免 Console 保存黑盒坏引用，运行时策略和计费命中更可解释。 |
| Release Build | `pnpm --dir extensions/echoflow-image build:publish` 已通过，并确认 `build/index.js`、Web `index.html`、`build/upgrade/0.0.1/index.js`、Worker processor 和 `storage/.gitkeep` 存在。 | 发布包前置产物已具备；真实安装和浏览器链路仍需全站启动后验证。 |

### 仍需跟进

| 优先级 | 模块 | 问题 | 后续方案 |
|--------|------|------|----------|
| P1 | Generation | 当前仍保留进程内 fallback，且多节点下需要验证插件自定义队列在部署拓扑中的 worker 数量和 Redis 配置。 | 真实环境跑队列 smoke；存储根目录后续改为插件配置或 SDK 提供路径。 |
| P1 | Release / Install | 当前安全默认值已合并进未上线首版 `0.0.1`，`build:publish` 已通过；仍缺真实安装 smoke。 | 全站启动恢复后验证安装流程、首版 Upgrade 幂等、插件登记、storage 保留和 Web / Console 页面可打开。 |
| P1 | Browser Smoke | 本轮 `echoflow-image` 构建通过，且容器日志显示插件已加载；但主应用随后被其他插件的 Nest 依赖错误打断，导致 `4090` 断连，暂不能公平完成绘画插件浏览器端到端。 | 恢复全站启动后，优先复测文生图提交、失败退款、历史轮询和结果展示。 |
| P2 | Billing / Policy | 已禁止孤儿模型级规则；多条启用计费或策略规则现在仍按最新创建记录命中，缺少数据库唯一约束或显式 `priority` 字段。 | 增加唯一启用约束或显式 `priority` 字段，并在 Console 展示命中规则。 |
| P2 | Policy | 并发和每日额度是提交前快照，高并发提交可能短暂越过阈值。 | 在创建事务内做配额占用，必要时引入 Redis 计数器。 |
| P2 | Idempotency | 相同 `requestKey` 会直接返回既有生成记录，不重新校验当前模型、余额或策略。 | 这是幂等语义所需，但前端需要把处理中/失败/成功状态展示清楚，避免用户误以为重新提交已生效。 |

### 已确认较好的边界

- Web / Console 服务层分别使用 `apiHttpClient` 和 `consoleHttpClient`，后端 Controller 也按 Web API 与 Console API 拆分。
- 生成任务禁止在 `PENDING` / `PROCESSING` 状态删除，避免后台写回软删除记录。
- 外部公开 URL 下载已有协议、DNS、私网网段和重定向防护。
- 上游返回的结果 URL 也会拒绝非 `http(s)`、凭证和本机/内网 host，避免把不安全地址写进历史记录。
