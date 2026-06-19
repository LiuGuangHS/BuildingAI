# EchoFlow BuildingAI 插件开发规范

本仓库是基于 BuildingAI 的 EchoFlow 二开与插件工作区。所有 Agent 和人工改动以本文件为准：主系统是需要持续吸收官方上游更新的二开基座，EchoFlow 业务优先落在插件内；确属平台公共能力的通知、多渠道、登录、计费、Secret、上传、队列和 Console 基础能力，可以按主系统模块边界实现，但必须记录与上游可能冲突的点。

## 核心边界

| 范围 | 规则 |
|---|---|
| 插件业务 | 新增独立业务能力优先放在 `extensions/<identifier>/`，EchoFlow 业务插件统一使用 `echoflow-*`。 |
| 主系统能力 | 平台级能力可以改主系统；禁止为了绕过插件能力而 patch 主系统。 |
| 默认可改 | `extensions/<identifier>/`、`skills/`、`templates/`、`docs/`、`.agents/`、`.codex/`、根目录协作文档。 |
| 默认谨慎 | `packages/`、`public/web/`、`scripts/`、`docker-compose.yml`、`turbo.json`、`pnpm-workspace.yaml`、根 `package.json`、锁文件和构建产物。 |
| 上游同步 | 拉取或合并官方上游前，先识别 EchoFlow 自有主系统能力，不把通知、多渠道、品牌、登录、计费、Secret、上传、队列和 Console 基础能力误当临时 patch 丢弃。 |

遇到 dirty worktree 时，不回滚非本人改动；如果同一文件已有用户改动，先读懂再顺着改。

## 官方依据

- 文档入口：`https://doc.buildingai.cc/7949221m0`
- 二开教程：`https://doc.buildingai.cc/8849389m0`
- 插件与框架：`https://doc.buildingai.cc/75445077f0`
- 应用开发：`https://doc.buildingai.cc/7977732m0`
- Extension SDK：`https://doc.buildingai.cc/8555126m0`
- 插件清单、后端、前端、计费、AI、Seeds、Upgrade、构建发布：`https://doc.buildingai.cc/8555110m0` 起的插件文档组
- 插件前端组件与工具：`https://doc.buildingai.cc/8593532m0`
- 插件后端工具与封装：`https://doc.buildingai.cc/8593545m0`

开发插件前优先对照官方文档、`templates/extension-starter/`、`extensions/simple-blog/` 和相关 SDK 参考。

## 插件结构

| 项目 | 要求 |
|---|---|
| 创建 | 优先用 `pnpm extension:create` 或 `pnpm buildingai extension:create`。 |
| 命名 | 目录、`manifest.json.identifier`、`package.json.name`、`defineRouteOption({ base, identifier })`、`defineExtensionViteConfig(packageJson)` 必须同名。 |
| 登记 | 本地插件必须写入 `extensions/extensions.json`，手工复制或恢复插件后同步检查登记。 |
| 版本 | `manifest.json` 与 `package.json` 版本一致；未上线插件首版修复合并回 `0.0.1` migration/upgrade，不制造无意义版本号。 |
| 示例 | `simple-blog`、`extension-starter` 是官方示例/模板，不作为 EchoFlow 业务插件命名或改造对象。 |
| 预留 | reserved/experimental 能力可保留，但不能进入默认运行路径，不能呈现为已上线能力。 |

## 后端规范

| 主题 | 规则 |
|---|---|
| 入口 | 后端入口使用 `src/api/index.ts` 导出插件 `AppModule`。 |
| 目录 | 模块按 `src/api/modules/{module}/controllers/{console,web}`、`services`、`dto` 组织。 |
| 实体 | 插件实体使用 `@ExtensionEntity()` 并落到插件独立 schema；不要用普通 `@Entity()` 写插件业务表。 |
| Controller | Web API 用 `@ExtensionWebController()`，Console API 用 `@ExtensionConsoleController()`。 |
| 装饰器 | 插件 Controller/Entity 装饰器从 `@buildingai/core/decorators` 导入；通用装饰器如 `Public`、`Playground`、`BuildFileUrl`、`SkipTransform` 从 `@buildingai/decorators` 导入。 |
| 依赖 | 优先使用 `@buildingai/extension-sdk`、`@buildingai/base`、`@buildingai/core/decorators`、`@buildingai/decorators`、`@buildingai/db`、`@buildingai/dto`、`@buildingai/pipe`、`@buildingai/errors`、`@buildingai/utils`。 |
| SDK 导出 | 主系统新增或修复插件 SDK 能力时，同步源码导出、`dist` 类型产物和调用方验证；插件不得引用只存在于源码但未进入公开 exports 的符号。 |

长流程默认接主系统 `QueueModule`、BullMQ/Redis 或官方队列能力。图像、合同、星盘等付费生成链路不保留进程内 `setTimeout` fallback；入队失败要写业务失败状态并返回可观测错误。

## 前端规范

| 主题 | 规则 |
|---|---|
| 入口 | 前端入口放 `src/web/main.tsx`。 |
| 路由 | 优先用 `@buildingai/web-core` 的 `defineRouteOption()`；复杂 Console 管理端使用 `consoleRoutes` + `consoleMenus` 多页面。 |
| HTTP | 优先用 `@buildingai/services` 的 `createPluginHttpClients()`，Web 调 Web API，Console 调 Console API。 |
| Service | 建议分为 `src/web/services/web/`、`src/web/services/console/`、`src/web/services/types/`。 |
| UI | 通用控件优先使用 `@buildingai/ui/components/ui/*` 的 `Button`、`Card`、`Input`、`Textarea`、`Select`、`Tabs`、`Badge`、`Label`、`Checkbox`、`Switch`。 |
| CSS | 插件 CSS 只负责布局、业务分组、特殊状态和响应式，不重写主系统组件边框、焦点环、禁用态、尺寸和主题色。 |
| 主题 | 主系统变量可能是 OKLCH 或直接颜色值；不要默认写 `hsl(var(--primary))` 二次包装。 |
| 卡片 | 顶层工作区可用系统 `Card` 分区，不在 Card 内再堆 Card。 |

用户端首页直接展示核心功能，不做营销落地页或“进入工作台”中间页。生成、画布、游戏化和经营类插件应在首屏给出可操作工作区；桌面端优先左侧输入/任务、右侧结果/历史，移动端优先单任务视图和页面内紧凑 Tab。

基础 UI 组件、插件 RootLayout、loading、toast、空状态和错误页属于每个插件首屏都可能加载的路径，不要为这些常驻能力静态引入 `lucide-react` 全量或动态图库；优先使用 CSS spinner、轻量状态符号或明确静态图标。Console 菜单如需动态图标，应在主系统图标组件层做白名单或静态映射，避免每个插件发布产物生成大量图标碎片或把大图标 chunk 预加载到用户端首页。

插件 Web 用户端默认运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内，外层已经提供主导航、账号、主题、全局布局和页面空间。插件内部应做嵌入式业务面板，不重复 App Header、用户头像/账号、全局统计、营销 Hero、独立侧边栏或完整应用外壳；仅展示当前业务需要的上下文，如当前档案、生成依据、价格组、失败退款、任务状态和结果操作。插件内容宽高要适配主系统可用区域，避免固定整页大壳、过宽居中容器和 `100vh` 背景造成与主系统割裂。

用户端文案避免泛化“AI 风”堆砌。生成类插件把智能感落到分析范围、扣费规则、失败退款、上下文来源和结构化结果；Console 可保留模型、Provider、AI 等运维术语。

## Web 与 Console 双入口

| | Web 用户端 | Console 管理端 |
|---|---|---|
| 页面目录 | `pages/index.tsx` 等 | `pages/console/*.tsx` |
| 路由配置 | `routes` | `consoleRoutes` + `consoleMenus` |
| 访问路径 | `/extension/{id}/` | `/extension/{id}/console/` |
| 后端装饰器 | `@ExtensionWebController("path")` | `@ExtensionConsoleController("path", "Group")` |
| API 路径 | `/{identifier}/api/{path}/*` | `/{identifier}/consoleapi/{path}/*` |
| HTTP client | `apiHttpClient` | `consoleHttpClient` |
| 职责 | 当前用户核心功能 | 管理员配置、运维、统计、CRUD |

常见错误：全部端点写进 Console Controller、Web 页面调用 Console API、只用 `consoleHttpClient`、Console 返回字段和前端类型不一致、上传审查绕过平台上传记录。

## AI、Secret 与计费

| 能力 | 应做 | 禁止 |
|---|---|---|
| LLM | 插件接入平台模型时优先注册 `AiPublicModule` 并使用 `PublicAiModelService`。 | 为合同、星盘、小镇等 LLM 插件自建模型或密钥管理。 |
| 底层 AI | 只有做底层工作流封装时直接使用 `@buildingai/ai-sdk`。 | 普通插件绕开主站模型、Provider 和 Secret。 |
| Provider Config | 从 `@buildingai/extension-sdk` 复用 `normalizeProviderConfig`，兼容 `apiKey/api_key`、`baseURL/baseUrl/base_url`、`webhookSecret` 等别名。 | 各插件重复维护 flatten helper。 |
| Secret | 图像、视频模型接入点只保存 `secretId`、`secretName`、可选 `baseUrlOverride`、优先级、超时、重试和启用状态。 | 保存业务 API Key 明文、密文副本或写入 `.env`、源码、前端包。 |
| 媒体模型 | 图像、视频采用插件内置固定模型目录；管理员只配置启用、展示名、默认参数、模型级计费和接入点。 | Console 手工新增协议模型、供应商或覆盖能力矩阵。 |
| 能力矩阵 | capability 由协议适配层真实支持反推；Responses 生图不暴露 mask，Images 纯生成不暴露图生图/mask/多参考图。 | 前端展示尚未实现的编辑能力。 |
| 计费 | 注册 `ExtensionBillingModule` 并使用 `ExtensionBillingService`，业务记录 ID 作为 `associationNo`，事务内传同一个 `EntityManager`。 | 直接修改用户余额或重复扣费。 |
| 退款 | 失败退款检查账务事实；退款失败写入业务记录 metadata，如 `providerMetadata.refundError`。 | 把失败退款描述为已闭环但没有真实验证。 |

付费生成入口必须在用户端说明分析/生成对象、扣费时机或价格组、失败退款策略。具体金额以后端 Console 配置为准，前端不得硬编码价格。

用户端 API 不返回 `secretId`、Base URL、API Key、上游任务 ID、管理员备注、未脱敏上游响应、管理员接入点详情或模型计费规则快照。图像/视频 Web Controller 必须走 public serializer。
前端类型同步区分 Web / Console 记录：用户端 service 和组件只使用 public 字段，Console 类型再扩展 `userId`、`taskId`、`rawRequest`、`rawResponse`、`baseURL`、`adminRemark` 等排障字段。

## 通知与多渠道

主站通知、多渠道投递和通知管理属于平台公共能力。插件只注册通知场景、提交用户通知事件和业务上下文，不在插件内重复实现 Web Push、公众号模板消息、短信或邮件发送器。

| 主题 | 要求 |
|---|---|
| SDK | 插件后端通过 `@buildingai/extension-sdk` 的 `ExtensionNotificationModule` / `ExtensionNotificationService` 接入。 |
| 注册 | 在模块初始化时调用 `registerScenes(extensionId, scenes)`；`sceneCode` 必须以插件 identifier 开头，例如 `echoflow-video.generation.succeeded`。 |
| 投递 | 业务终态后调用 `notifyUser()`；主站通知不可用或投递失败只记录 skipped/failed，不回滚插件业务状态。 |
| 场景追溯 | 终态事件提供 `sourceType`、`sourceId` 或 `dedupeKey`，避免轮询、Webhook、手动刷新和恢复扫描重复投递；主站用 `userId + dedupeKey` 唯一约束兜住并发重复。 |
| 浏览器 Push | 使用维护中的第三方库；不得手写 VAPID/AES/JWT，除非没有可维护依赖且 README 记录原因、风险和迁移条件；订阅 endpoint 必须校验 HTTPS、无凭据、非本机/内网/保留地址。 |
| 链接 | 通知跳转、Web Push 点击和公众号模板 URL 只允许站内相对路径或 HTTP/HTTPS URL，不允许协议相对地址、危险协议或带凭据 URL。 |
| 偏好 | 仅 `userConfigurable` 场景进入用户通知偏好；关闭偏好后不创建新通知，但不影响业务终态。 |
| 公众号 | 走 `WechatOaService` 模板消息接口；未绑定 openid、缺模板或缺公众号配置只记录 skipped/failed。 |
| 短信 | 走主系统短信模块。 |
| 管理 | 场景、渠道、模板、投递日志和测试入口必须进入 Console 管理，入口为 `/console/notice/notification-management`；预留渠道不能保存为实际投递渠道。 |

## 数据、Upgrade 与存储

| 主题 | 规则 |
|---|---|
| 表结构 | 写插件 migration：`extensions/<identifier>/src/api/db/migrations/`。 |
| 数据修复 | 写 Upgrade：`src/api/upgrade/<version>/index.ts`。 |
| 边界 | 不把表结构修改塞进 Upgrade，不把一次性历史修复写进正常 service。 |
| 首版 | 当前未上线插件可直接调整 `0.0.1` migration/upgrade、实体和默认数据，不保留本地中间态旧字段兼容层。 |
| Seeds | 只负责首次安装初始化数据，必须可重复执行并用 `shouldRun()` 或唯一键避免重复。 |
| 静态文件 | 随发布包携带的静态文件放 `storage/static`；运行时上传/生成文件放 `storage/uploads` 等运行目录。 |
| 大内容 | 历史记录存 URL、file ID 或相对路径，避免把大文件或 base64 放进数据库。 |
| 删除保护 | `PENDING`、`PROCESSING`、导出中、审查中等状态默认禁止删除。 |

允许保留清晰的供应商协议适配层，例如 `responses`、`images`、`openai-compatible-images` 或视频异步网关协议；这类协议分层不是旧业务兼容层。

## 上传与 URL 安全

- 用户上传进入插件业务时，优先使用平台 `/upload/file` 或共享 `uploadFile()` 返回的 `fileId`。
- 后端校验上传者、插件归属、大小、MIME/扩展名和 URL 格式后再处理文件。
- 文件解析、导出、AI 生成等异步流程写回业务记录前重新读取记录并检查 `deletedAt`。
- SSRF 防护默认拒绝任意外部 URL 指向本机或内网。
- 已通过平台 `fileId`、上传者、插件归属、大小和 MIME 校验的插件上传文件，可以按本插件 `/uploads/` 路径允许本地或私有化部署域名。
- Provider 返回结果 URL 不允许指向本机、内网、带凭据或非 http/https 协议。
- `.gitignore` 保持忽略运行时 `storage/*`，但允许 `storage/static` 与必要 `.gitkeep` 入库。

## 游戏化与记忆

- 游戏化或经营类插件的资源变化必须可审计：事件 result 或业务记录保留 before/after、delta、规则来源或明细，用户端展示玩家可读解释，Console 可排查异常收益。
- 用户端存在日常行动循环时，服务端加每日行动预算、同日重复动作拦截和休息重置；前端展示剩余次数和拦截原因。
- 角色/NPC 记忆分层保存长期摘要、偏好、约定、关键时刻和有限最近消息；传给 LLM 时使用白名单摘要和短窗口。
- 当“记忆”是玩法卖点时，必须有确定性闭环影响后续行动、事件、关系收益、推荐目标、行动预览或 Console 判断。
- 初始建筑、角色、行动、事件选项、日常任务、周目标、主线章节、成就、活动候选和留存钩子内容优先放在插件 catalog/seed/config 层；service 负责事务、校验和编排，规则服务负责计算。
- 内容包型或经营游戏插件的测试要守住 catalog 边界：新增运营内容时断言 service/rule service 没有重新内联大段任务、章节、活动候选数组。

## 构建、发布与验证

发布前检查 `manifest.json` 与 `package.json` 版本一致且为合法 semver，发布版本不能低于当前版本。未上线插件不要因为本地修复反复增加版本号。

`pnpm extension:release` 只按白名单复制 `.output`、`build`、`src`、`storage/static`、`storage/.gitkeep`、`manifest.json`、`package.json`、`README.md`、`tsconfig*`、`tsup.config.ts`、`eslint.config.mjs`、`LICENSE` 等文件；不要依赖白名单外文件进入发布包。

常用验证命令：

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:publish
pnpm --filter <identifier> test
```

涉及发布或安装时至少验证：版本识别、migration 执行、Upgrade 执行、旧数据保留、storage/node_modules 保留、服务重启后页面可打开。本地浏览器验证优先用 `http://127.0.0.1:4090`。

代码收口阶段至少跑类型检查、API 构建、Web 构建和静态 diff 审查。真实外部模型调用、真实 Secret、Webhook 和失败退款属于正式联调阶段，未执行时不得描述为真实闭环已完成。

若 `build:web` 失败在 Vite/Rolldown 配置加载或 HTML entry 解析阶段，先用最小 `index.html + main.js` smoke 复现，区分工具链/环境问题与插件业务代码问题。

插件单测若 mock `@buildingai/extension-sdk`、`@buildingai/core/modules` 或主系统 service，新增 SDK 导出后同步测试替身；测试替身不能缺少 `normalizeProviderConfig` 这类运行期会调用的公共函数。

## Git 与上游

- 开发前固定检查：`git status --short --branch`、`git remote -v`、`git fetch origin`；只有确认已配置 `upstream` 后才执行 `git fetch upstream`。
- 官方上游只读：`upstream=https://github.com/BidingCC/BuildingAI.git`。
- `remote.upstream.pushurl` 必须保持 `DISABLED_DO_NOT_PUSH_TO_UPSTREAM`。
- 禁止向官方上游提交、推送或开 PR，除非用户单次明确要求。
- 禁止 `git push upstream`、`git push --mirror`、`git push --all`。
- 需要推送时先确认目标远端和分支；二开仓库的 `origin` 不等同于官方上游。
- 大工作区改动拆语义提交，避免一个 checkpoint commit 混入多个插件和上游恢复。
- 用户要求中文提交信息时，保持 Conventional Commit `type(scope): 中文摘要`。

建议提交分组：上游只读配置与 `simple-blog` 官方恢复；`extensions/extensions.json` 登记；每个 EchoFlow 插件各自业务修复、README 和测试；项目级协作文档更新。

## 环境基线

- Node.js：要求 `>=22.20.x <23`；本机 fnm 已安装 `v22.23.0`。
- Codex 桌面非交互 PowerShell 不保证自动加载 `fnm` 初始化；若裸 `node -v` 命中全局 Node 24，不要误判为缺少 Node 22。先显式使用：`$node22 = "$env:APPDATA\fnm\node-versions\v22.23.0\installation"; $env:PATH = "$node22;$env:PATH"; node -v; corepack pnpm -v`。
- pnpm：项目声明 `pnpm@10.20.0`。
- Docker：本机实测 Docker `29.5.3`、Compose `v5.1.4`。
- 官方建议本地开发优先使用 pnpm：根目录安装依赖后运行 `pnpm dev:main`，插件目录可运行 `pnpm dev`、`pnpm dev:web`、`pnpm dev:api`。
- Docker 可用于基础依赖和完整环境验证：`docker compose up -d`，入口默认 `http://localhost:4090/install`。
- 手动路径：准备 PostgreSQL、Redis、主系统 `.env`，再运行 `pnpm install` 与 `pnpm start`。
- 插件业务配置不放 `.env`，走管理员后台配置或主站 Secret。

## 品牌静态资源

- `logo.png` 是方形品牌图，用于 favicon、头像、折叠菜单和 `size-8` 等方形展示位。
- `logo-full.png` 是横版品牌图，用于工作台侧栏、登录页、AppLogo 等横向展示位。
- 默认 UI 不再使用 `logo.svg` 或 `logo-full.svg`；新增引用时按展示位选择 PNG。
- 静态品牌资源变更后至少运行 `pnpm --filter echoflowai-client build`。
- 发布态 `public/web/assets` 由构建或发布流程刷新，不手工修改压缩产物。

## 当前阶段看板

| 优先级 | 事项 | 完成条件 |
|---|---|---|
| P1 | 真实端到端 smoke | 配好主站 Secret、测试用户、余额和存储，覆盖图像、视频、合同、星盘、小镇的成功、失败、退款或 fallback。 |
| P1 | 队列与恢复 smoke | 验证图像、合同、星盘和视频的 Redis/Worker 拓扑、抢占、重复执行保护、超时回收、重启恢复、软删除保护和失败补偿。 |
| P2 | 主系统能力复用审查 | 继续清理直接 provider 注入、内存队列、进程内限流、手写密钥脱敏、手写文件 URL、手写通知/签名协议和可替换裸 UI 控件。 |
| P2 | 上传与 URL 安全审查 | 所有接收文件、URL、Webhook 回调和远程资源下载入口只接受平台上传或受信任 provider 返回值。 |
| P2 | 异步终态一致性审查 | 图像、合同、星盘等异步链路具备二次读取、锁定、终态短路和软删除保护。 |
| P2 | 测试补强 | 为失败退款、计费幂等、队列入队失败、恢复扫描、文件归属、世界规则和 AI fallback 补 focused tests。 |
| P3 | 发布前整理 | 清理或确认未跟踪文件、锁文件必要性、构建产物和提交分组。 |

## 交付检查

1. 明确业务目标、插件 identifier、可改文件、谨慎文件、数据/升级/存储方案和验证命令。
2. 实现只落在插件或约定二开目录；主系统缺口必须能说明原因、影响、上游风险和验证方式。
3. 验证至少覆盖插件构建、类型检查、后端 API 或前端页面 smoke；涉及发布时跑 `extension:release`。
4. 交付时说明改动范围、验证结果和剩余阻塞；不得把“未配置 upstream”或“服务未 ready”包装成已完成。
