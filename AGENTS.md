# EchoFlow BuildingAI 插件开发规范

本仓库是基于 BuildingAI 的 EchoFlow 二开与插件工作区。所有 Agent 和人工改动都以本文件为准：主系统作为只读基座，业务能力优先落在插件内，并优先复用 BuildingAI 官方公开能力。

## 工作边界

- 新增业务功能只能放在 `extensions/<identifier>/` 或经用户确认的独立二开目录。
- 默认可改：`extensions/<identifier>/`、`skills/`、`templates/`、`docs/`、`.agents/`、`.codex/`、根目录协作文档。
- 默认只读：`packages/`、`public/web/`、`scripts/`、`docker-compose.yml`、`turbo.json`、`pnpm-workspace.yaml`、根 `package.json`、锁文件和主系统构建产物。
- 禁止通过 patch 主系统绕过插件能力。若官方扩展点不够，先记录缺口来源、影响、候选方案、上游升级风险和回滚方式，等用户本次明确授权后再动主系统。
- 插件调用主系统能力必须走官方公开 SDK、装饰器、CLI、扩展注册、前端路由、HTTP client、平台上传、队列、缓存、计费和 AI 服务。
- 修改运行联网、拉镜像、安装依赖、写 Docker 数据或执行发布前，要说明目的和影响。
- 遇到 dirty worktree 时，不回滚非本人改动；如果同一文件已有用户改动，先读懂再顺着改。

## 官方依据

- 文档入口：`https://doc.buildingai.cc/7949221m0`
- 二开教程：`https://doc.buildingai.cc/8849389m0`
- 插件与框架：`https://doc.buildingai.cc/75445077f0`
- 应用开发：`https://doc.buildingai.cc/7977732m0`
- 创建应用：`https://doc.buildingai.cc/7977739m0`
- 模板结构：`https://doc.buildingai.cc/7977761m0`
- 应用开发运行：`https://doc.buildingai.cc/7977765m0`
- 打包发布：`https://doc.buildingai.cc/7977779m0`
- 插件更新：`https://doc.buildingai.cc/7977809m0`
- 插件清单：`https://doc.buildingai.cc/8555110m0`
- 插件后端：`https://doc.buildingai.cc/8555116m0`
- 插件前端：`https://doc.buildingai.cc/8555121m0`
- Extension SDK：`https://doc.buildingai.cc/8555126m0`
- 插件计费：`https://doc.buildingai.cc/8555133m0`
- 插件 AI 能力：`https://doc.buildingai.cc/8555138m0`
- Seeds、Upgrade 与存储：`https://doc.buildingai.cc/8555188m0`
- 插件升级开发：`https://doc.buildingai.cc/8556434m0`
- 构建与发布：`https://doc.buildingai.cc/8555193m0`
- 插件前端组件与工具：`https://doc.buildingai.cc/8593532m0`
- 插件后端工具与封装：`https://doc.buildingai.cc/8593545m0`

## 插件命名与登记

- 优先用官方 CLI 创建插件：`pnpm extension:create` 或 `pnpm buildingai extension:create`。
- 插件目录必须是 `extensions/<identifier>/`；`identifier` 使用小写字母、数字和连字符。
- EchoFlow 业务插件统一使用 `echoflow-*` 前缀；每个插件对应一个独立业务目标，不复用旧目录承载无关能力。
- `simple-blog`、`extension-starter` 等官方示例/模板不作为业务插件命名参考，也不做 EchoFlow 业务化改造。
- `manifest.json.identifier`、`package.json.name`、目录名、`defineRouteOption({ base, identifier })`、`defineExtensionViteConfig(packageJson)` 必须同名。
- 本地插件必须登记到 `extensions/extensions.json` 才能被本地环境发现；手工创建、复制、恢复插件时都要同步检查登记。
- `manifest.json` 和 `package.json` 版本必须一致。未上线插件首版修复优先合并回首版 migration/upgrade，不为本地修复制造无意义版本号。
- 待开发、预留和扩展点不是垃圾逻辑，可以保留；但必须标明 `reserved`、`experimental` 或后续目标，不能进入默认运行路径，不能对用户或管理员呈现为已上线能力。

## 后端规范

- 后端入口使用 `src/api/index.ts` 导出插件 `AppModule`。
- 模块按 `src/api/modules/{module}/controllers/{console,web}`、`services`、`dto` 组织。
- 插件实体使用 `@ExtensionEntity()`，表落到插件独立 schema；不要用普通 `@Entity()` 写插件业务表。
- Web API 用 `@ExtensionWebController()`，Console API 用 `@ExtensionConsoleController()`。
- 插件 Controller/Entity 装饰器从 `@buildingai/core/decorators` 导入；通用装饰器如 `Public`、`Playground`、`BuildFileUrl`、`SkipTransform` 再从 `@buildingai/decorators` 导入。
- 后端依赖优先使用 `@buildingai/extension-sdk`、`@buildingai/base`、`@buildingai/core/decorators`、`@buildingai/decorators`、`@buildingai/db`、`@buildingai/dto`、`@buildingai/pipe`、`@buildingai/errors`、`@buildingai/utils`。
- 业务长流程优先接主系统 `QueueModule`、BullMQ/Redis 基础设施或官方队列能力；保留本地 fallback 时必须有抢占、幂等、超时回收和软删除保护。

## 前端规范

- 前端入口放 `src/web/main.tsx`。
- 路由优先用 `@buildingai/web-core` 的 `defineRouteOption()`。
- HTTP 优先用 `@buildingai/services` 的 `createPluginHttpClients()`。
- 前端依赖优先使用 `@buildingai/ui`、`@buildingai/http`、`@buildingai/services`、`@buildingai/services/shared`、`@buildingai/stores`、`@buildingai/hooks`、`@buildingai/web-core`。
- 插件 service 建议分为 `src/web/services/web/`、`src/web/services/console/`、`src/web/services/types/`。
- 用户端首页必须直接展示功能，不做营销落地页或“进入工作台”中间页。
- Console 页面只做管理员配置、列表、CRUD、批量操作、运维和统计，不混入用户工作流。

## 双入口与双 API

| | Web 用户端 | Console 管理端 |
|---|---|---|
| 页面目录 | `pages/index.tsx` 等 | `pages/console/*.tsx` |
| 路由配置 | `defineRouteOption({ routes: [...] })` | `defineRouteOption({ consoleRoutes: [...], consoleMenus: [...] })` |
| 访问路径 | `/extension/{id}/` | `/extension/{id}/console/` |
| 后端装饰器 | `@ExtensionWebController("path")` | `@ExtensionConsoleController("path", "Group")` |
| API 路径 | `/{identifier}/api/{path}/*` | `/{identifier}/consoleapi/{path}/*` |
| HTTP client | `apiHttpClient` | `consoleHttpClient` |
| 职责 | 当前用户的核心功能 | 管理员配置与运营 |

常见错误：

- 把全部端点写在一个 Console Controller。
- Web 页面调用 Console API。
- 只用 `consoleHttpClient`，忽略 `apiHttpClient`。
- Console 返回字段和前端类型不一致，例如 `provider` 一会儿是字符串、一会儿是对象。
- 用户上传审查、解析或导入功能绕过平台上传记录，直接接收任意外部 URL。

## AI 与计费

- 插件接入平台模型时，优先注册 `AiPublicModule` 并使用 `PublicAiModelService` 获取模型、供应商配置和 provider adapter。
- 只有做底层 AI 工作流封装时才直接使用 `@buildingai/ai-sdk`。
- 插件模型配置页只列 `isActive: true` 且 `modelType: "llm"` 的模型，并过滤未启用 Provider；保存默认模型时后端也要重新校验模型和 Provider 状态。
- Console 模型列表返回值必须和前端类型一致。若只需展示供应商，优先返回 `providerName`。
- 插件第三方 API Key 和服务参数必须走管理员 Console 配置、数据库配置或平台密钥配置，不使用环境变量作为插件业务配置入口。
- 不要把真实密钥写入源码、`manifest.json`、前端包或 `.env`。
- 需要扣减或返还用户积分时，优先注册 `ExtensionBillingModule` 并使用 `ExtensionBillingService`。
- AI 生成、文件解析、第三方任务等长流程默认采用“余额预检 -> 业务记录入库 -> 预扣 -> 成功写结果或失败退款”。
- 扣费使用业务记录 ID 作为 `associationNo`，并检查同一 `associationNo` 是否已有扣费账务记录，避免重复扣费。
- 事务内扣费/退款时，把同一个 `EntityManager` 传给 `deductUserPower()` 或 `addUserPower()`。
- 退款失败必须写入业务记录元数据，例如 `providerMetadata.refundError`。

## 数据、Upgrade 与存储

- 表结构变化写插件 migration：`extensions/<identifier>/src/api/db/migrations/`。
- 数据修复、默认值回填、跨表搬迁、历史数据兼容写 Upgrade：`src/api/upgrade/<version>/index.ts`。
- 不要把表结构修改塞进 Upgrade，也不要把一次性历史修复写进正常 service 运行逻辑。
- 未上线首版内的修复合并进 `0.0.1` migration/upgrade；已上线后再按版本升级。
- Seeds 只负责首次安装初始化数据，必须可重复执行并用 `shouldRun()` 或唯一键避免重复。
- EchoFlow 业务插件的种子数据、质量门禁、路线图和后续待办统一写入插件 `README.md`，不新增独立 `SEEDS.md`。
- 运行时上传/生成文件放 `storage/uploads` 等运行目录；随发布包携带的静态文件放 `storage/static`。
- 历史记录存 URL、文件 ID 或相对路径，避免把大文件或 base64 放进数据库。
- 用户上传文件进入插件业务时，优先使用平台 `/upload/file` 或共享 `uploadFile()` 返回的 `fileId`。
- 后端必须校验上传者、插件归属、大小、MIME/扩展名和 URL 格式后再处理文件。
- 文件解析、导出、AI 生成等异步流程写回业务记录前要重新读取记录并检查 `deletedAt`。
- `PENDING`、`PROCESSING`、导出中、审查中等状态默认禁止删除，避免后台任务继续写入软删除记录。
- SSRF 防护默认拒绝任意外部 URL 指向本机或内网；但已通过平台 `fileId`、上传者、插件归属、大小和 MIME 校验的插件上传文件，可以按本插件 `/uploads/` 路径允许本地或私有化部署域名。
- `.gitignore` 保持忽略运行时 `storage/*`，但允许 `storage/static` 与必要 `.gitkeep` 入库。

## 构建、发布与验证

- 发布前检查 `manifest.json` 与 `package.json` 版本一致且为合法 semver。
- 发布版本不能低于当前版本；未上线插件不要因为本地修复反复增加版本号。
- `pnpm extension:release` 按白名单复制 `.output`、`build`、`src`、`storage/static`、`storage/.gitkeep`、`manifest.json`、`package.json`、`README.md`、`tsconfig*`、`tsup.config.ts`、`eslint.config.mjs`、`LICENSE` 等文件。
- 不要依赖发布白名单外文件进入发布包。
- 发布包生成前默认选择 rebuild；如跳过 rebuild，必须说明使用哪一次构建产物。
- 涉及发布或安装时至少验证：版本识别、migration 执行、Upgrade 执行、旧数据保留、storage/node_modules 保留、服务重启后页面可打开。
- 本地浏览器验证优先用 `http://127.0.0.1:4090`；此前 `localhost` 偶发超时，不要误判为插件问题。

常用验证命令：

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:publish
pnpm --filter <identifier> test
```

## Git 与上游

- 开发前固定检查：`git status --short --branch`、`git remote -v`、`git fetch origin`；只有确认已配置 `upstream` 后才执行 `git fetch upstream`。
- 官方上游只读：`upstream=https://github.com/BidingCC/BuildingAI.git`。
- `remote.upstream.pushurl` 必须保持 `DISABLED_DO_NOT_PUSH_TO_UPSTREAM`。
- 禁止向官方上游提交、推送或开 PR，除非用户单次明确要求。
- 禁止 `git push upstream`、`git push --mirror`、`git push --all`。
- 需要推送时必须先确认目标远端和分支；二开仓库的 `origin` 不等同于官方上游。
- 大工作区改动要拆语义提交，避免一个 checkpoint commit 混入多个插件和上游恢复。
- 用户要求中文提交信息时，保持 Conventional Commit `type(scope): 中文摘要`。

建议提交分组：

1. 上游只读配置与 `simple-blog` 官方恢复。
2. `extensions/extensions.json` 登记与本地发现元数据。
3. 每个 EchoFlow 插件各自的业务修复、README 和测试。
4. 项目级协作文档更新。

## 环境基线

- Node.js：要求 `>=22.20.x <23`，本机实测 `v22.20.0`。
- pnpm：项目声明 `pnpm@10.20.0`，本机实测 `10.20.0`。
- Docker：本机实测 Docker `29.5.3`、Compose `v5.1.4`。
- 官方建议本地开发优先使用 pnpm：根目录安装依赖后运行 `pnpm dev:main`，插件目录可运行 `pnpm dev`、`pnpm dev:web`、`pnpm dev:api`。
- Docker 可用于基础依赖和完整环境验证：`docker compose up -d`，入口默认 `http://localhost:4090/install`。
- 手动路径：准备 PostgreSQL、Redis、主系统 `.env`，再运行 `pnpm install` 与 `pnpm start`。
- 插件业务配置不放 `.env`，走管理员后台配置。

## 品牌静态资源约定

- `logo.png` 是方形品牌图，用于 favicon、头像、折叠菜单和 `size-8` 等方形展示位。
- `logo-full.png` 是横版品牌图，用于工作台侧栏、登录页、AppLogo 等横向展示位。
- 默认 UI 不再使用 `logo.svg` 或 `logo-full.svg`；新增引用时按展示位选择 PNG。
- 静态品牌资源变更后至少运行 `pnpm --filter echoflowai-client build`。
- 发布态 `public/web/assets` 由构建或发布流程刷新，不手工修改压缩产物。

## 交付流程

1. 先读官方插件文档、`templates/extension-starter/`、`extensions/simple-blog/` 和相关 SDK 参考。
2. 写计划时明确：业务目标、插件 `identifier`、可改文件、只读文件、数据/升级/存储方案、验证命令。
3. 实现只落在插件或约定二开目录；主系统缺口必须先记录并等待授权。
4. 验证至少覆盖插件构建、类型检查、后端 API 或前端页面 smoke test；涉及发布时跑 `extension:release`。
5. 交付时说明改动范围、验证结果和剩余阻塞。不得把“未配置 upstream”或“服务未 ready”包装成已完成。

## 项目状态附录

以下不是长期规范，只是当前工作区快照。执行前必须重新核对。

- 2026-06-16：官方上游已配置为 fetch-only：`upstream=https://github.com/BidingCC/BuildingAI.git`，`remote.upstream.pushurl=DISABLED_DO_NOT_PUSH_TO_UPSTREAM`。
- 2026-06-16：`extensions/simple-blog/` 已恢复到 `upstream/master` 官方版本；`extensions/extensions.json` 只保留本地发现所需登记。
- 2026-06-16：EchoFlow 业务插件为 `echoflow-image`、`echoflow-video`、`echoflow-contract-generation`、`echoflow-astrology-fortune`、`echoflow-ai-town`。
- 2026-06-16：上述 5 个 EchoFlow 业务插件都按未上线首版 `0.0.1` 收口，除非用户明确要求上线升级，否则不要增加版本号。

## 任务看板附录

以下任务用于当前阶段排期，不覆盖前文长期规范；完成、失效或优先级变化时应及时更新。

### P1 发布安装 smoke

- 2026-06-16 已完成：5 个 EchoFlow 业务插件均通过 `pnpm --filter <identifier> build:publish`。
- 2026-06-16 已完成：5 个插件均具备 `build/index.js`、`.output/public/index.html`、`build/upgrade/0.0.1/index.js`、README、`storage/static`、`storage/.gitkeep`。
- 2026-06-16 已完成：合同、星盘、小镇插件的 migration 产物进入 `build/db/migrations`；图像、视频插件当前首版表结构和历史修复收口在 `0.0.1` upgrade。
- 2026-06-16 已完成：Browser smoke 验证 5 个插件 Web/Console 入口均可打开且无浏览器 console error。
- 注意：插件前端重新构建后，需要重启服务或刷新运行态静态索引；否则可能出现旧 `index.html` 引用已删除 hash 资源，表现为空白页且无 React console error。

### P1 真实端到端 smoke

- 准备真实模型/API Key、测试用户、余额和插件存储。
- `echoflow-image`：覆盖文生图、图生图、mask、失败退款、结果转存。
- `echoflow-video`：覆盖 HappyHorse 四类模型、Webhook、状态映射、失败退款、提示词优化到生成。
- `echoflow-contract-generation`：覆盖合同生成、上传审查、文件归属校验、队列生成、版本与导出。
- `echoflow-astrology-fortune`：覆盖报告生成、计费退款、队列 worker、超时回收和删除保护。
- `echoflow-ai-town`：覆盖创建存档、行动、聊天、AI fallback、每日限制和并发锁。

### P1 队列与恢复 smoke

- 2026-06-16 已修复：合同、星盘恢复逻辑只重新入队超过超时阈值的旧 `PENDING/PROCESSING` 记录，避免把刚更新的忙碌任务重复入队。
- 验证 `echoflow-image`、`echoflow-contract-generation`、`echoflow-astrology-fortune` 的 Redis/Worker 行为。
- 覆盖任务抢占、重复执行保护、超时回收、重启恢复、软删除保护和失败补偿。
- 如果主系统队列能力无法满足动态插件队列，先记录缺口与候选方案，不直接 patch 主系统。

### P2 主系统能力复用审查

- 2026-06-16 已完成：合同、星盘插件改为导入 `AiPublicModule` 提供 `PublicAiModelService`，移除插件模块内手动注册主系统 AI provider/secret 服务与实体；保留必要的 `AiModel` 查询和 `AccountLog` 幂等检查仓库。
- 2026-06-16 已完成：小镇插件改为导入 `AiPublicModule`，移除模块内手动注册 `PublicAiModelService`、`SecretService` 以及主系统 provider/secret 实体。
- 2026-06-16 已完成：合同插件审查/导出入口改为行锁抢占 `reviewing` / `exporting` 状态后再执行长流程，避免并发删除或处理中状态被同步请求旧对象覆盖。
- 2026-06-16 已确认：视频插件 Provider Registry 中未上线供应商属于 `reserved` 扩展点，不删除；当前运行路径只允许 HappyHorse ready adapter，旧全局 registry 单例不进入运行路径，后续多供应商前再统一注册入口。
- 继续审查插件自造逻辑是否能收敛到 `AiPublicModule`、`PublicAiModelService`、`ExtensionBillingModule`、`QueueModule`、`CacheService`、平台上传和公开 HTTP client。
- 对仍保留插件内实现的部分，在插件 README 写清楚原因、风险和迁移条件。
- 优先清理直接 provider 注入、内存队列、进程内限流、手写密钥脱敏和手写文件 URL 拼接。
- 审查预留功能时先判断是否影响当前运行路径；只清理残留引用、误导性文案和越界调用，不因“待开发”本身删除代码。

### P2 上传与 URL 安全审查

- 2026-06-16 已修复：合同上传审查在完成平台 `fileId`、上传者、插件归属、大小和 MIME 校验后，允许本插件平台上传 URL 使用 `127.0.0.1`、`localhost` 或私有化部署域名；任意外部 URL 仍拒绝本机和内网地址。
- 2026-06-16 已修复：视频插件 HappyHorse `baseUrl` 在 Console 配置和客户端构造两层拒绝本机、内网、凭据片段和非 http/https 协议。
- 继续审查所有接收文件、URL、Webhook 回调和远程资源下载的入口，确认只接受平台上传或受信任 provider 返回值。
- 对 provider 返回结果继续保持更严格规则：生成结果 URL 不允许指向本机、内网、带凭据或非 http/https 协议。

### P2 异步终态一致性审查

- 2026-06-16 已修复：视频插件 webhook、轮询、超时扫描和取消在写回状态前重新加悲观锁；若记录已进入成功/失败终态，不再用旧对象覆盖终态，也避免成功后失败退款。
- 继续审查图像、合同、星盘等异步链路的终态写回是否都具备二次读取、锁定、终态短路和软删除保护。

### P2 测试补强

- 为合同生成、上传审查、文件归属校验、DOCX 构建补 focused unit tests。
- 为星盘报告生成、计费幂等、超时任务回收补 focused unit tests。
- 为小镇世界规则、关系推进、AI 建议和聊天补 focused unit tests。
- 为图像/视频的失败退款、幂等、策略命中和队列 fallback 补关键测试。

### P3 发布前整理

- 2026-06-16 已完成：运行态 `data/.installed`、`data/versions/` 与辅助 `.od-skills/` 已通过 `.gitignore` 收敛，避免混入插件源码候选。
- 清理或确认未跟踪文件：`processors/`、队列常量、测试文件、`storage/.gitkeep`。
- 检查 `pnpm-lock.yaml` 是否为必要变更；无必要则不要混入插件提交。
- 按语义拆提交：上游恢复、登记、每个插件、项目文档分别提交。
