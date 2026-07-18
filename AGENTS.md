# EchoFlow BuildingAI Agent Guide

本仓库是基于 BuildingAI 的 EchoFlow 二开与插件工作区。本文是跨插件、跨主系统的长期规范主源；插件自己的事实写在 `extensions/<identifier>/README.md`。不要把临时计划、截图、QA checklist 或一次性分析当作长期事实源。

## 1. 权威顺序

1. 机器事实：`package.json`、`.nvmrc`、`pnpm-workspace.yaml`、`turbo.json`、`.env.example`、`docker-compose.yml`、`ecosystem.config.js`、`extensions/extensions.json`、各插件 `package.json` / `manifest.json`。
2. 源码事实：API 启动、extension loader、SDK exports、frontend routing/build helpers 等真实代码。
3. 本文件：跨仓库边界、安全、验证和文档治理。
4. 插件 README：单插件业务目标、入口、特有边界、验证证据、风险和下一步。
5. 包级 README / skills：包 API 或工作流说明；不得覆盖上面事实源。

分层文档不会被所有 agent 自动读取。若把细则下沉到 skill、subagent 或 README，入口文件必须显式路由到它。

## 2. 任务路由

| 任务 | 必读/调用 |
|---|---|
| 跨仓库规范、架构或边界 | `AGENTS.md`、`CLAUDE.md` |
| API / auth / Secret / upload / queue / billing / DB | `packages/api/ai-rules.md`、相关源码、`security-boundary-reviewer` |
| Client | `packages/client/README.md`、`packages/client/package.json`、相关 route/page |
| Shared package | 读取目标目录最近的 `package.json`、README、`src/index.ts` 或 exports；不要从包名反推目录，`@buildingai/core` 实际位于 `packages/core` |
| Extension 普通源码 bugfix | 对应插件 README 的相关章节、`package.json`、错误栈直达源码；不默认调用 reviewer |
| Extension 局部 Web build failure | README 的构建/风险章节、`package.json`、Vite config、build wrapper；默认不读 manifest/registry，不调用 UI workflow、reviewer 或 release skill |
| Extension metadata / 依赖 / SDK export / 发布边界 | 插件 README、`package.json`、`manifest.json`、必要时 `extensions/extensions.json`、`extension-boundary-reviewer` |
| 插件 UI 设计 / Design Gallery / 前后端 UI 契约 | `.claude/design-workflow.md`、目标插件 README、`echoflow-ui-workflow` |
| `echoflow-ai-town` 分阶段续作 / 长期路线 | 插件 `README.md`、`ROADMAP.md`、`skills/echoflow-ai-town-roadmap/SKILL.md`、当前源码与验证证据 |
| `echoflow-video` 分阶段续作 / AI 短剧路线 | 插件 `README.md`、`ROADMAP.md`、`skills/echoflow-video-roadmap/SKILL.md`、当前源码与验证证据 |
| `echoflow-astrology-fortune` 分阶段续作 / 领域计算 | 插件 `README.md`、`skills/echoflow-astrology-roadmap/SKILL.md`、领域变更按需调用 `astrology-domain-reviewer` |
| Extension 发布/交付 | `/extension-release-check` |
| 跨 package、根配置或验证范围不明确 | `/repo-verify`；单 package 局部改动按目标 `package.json` 选择最小验证 |
| Skills / reviewer / hooks | `skills/README.md`、`skill-developer`、`scripts/sync-skills.mjs`、`scripts/check-agent-governance.mjs` |
| 合同插件后续开发/交接 | `extensions/echoflow-contract-generation/README.md`、`skills/contract-generation-development/SKILL.md`、`repo-verify`；再按任务读取实际源码和测试 |
| 外部库新 API | 优先使用 Codex 运行时提供的 Context7；当前会话未暴露时使用该库官方文档，不恢复项目级 `.claude/mcp` 启动器 |

Reviewer 只审查本轮明确 diff：metadata/依赖/SDK/发布归 `extension-boundary-reviewer`，API/Secret/上传/事务/队列/计费归 `security-boundary-reviewer`，Web UI/public capability/Design Gallery 归 `extension-ui-contract-reviewer`。独立审查可并行，主 agent 负责去重、修改和最终验证。

## 3. 核心边界

| 范围 | 规则 |
|---|---|
| 插件业务 | 新增独立 EchoFlow 业务优先放在 `extensions/echoflow-*`。 |
| 主系统能力 | 只有平台公共能力才改主系统，例如通知、多渠道、登录、计费、Secret、上传、队列、Console 基础能力。 |
| 禁止绕路 | 不得为了绕过插件能力而 patch 主系统；插件私有默认场景、模型协议、业务表、运营内容不得放进主系统。 |
| 上游同步 | 主系统是持续吸收官方上游的二开基座；合并上游前必须识别 EchoFlow 自有公共能力，避免误删。 |
| Dirty worktree | 不回滚、不覆盖非本人改动；同文件已有用户改动时先读懂再顺着改。 |

默认谨慎文件：`packages/**`、`public/web/**`、`scripts/**`、`docker-compose.yml`、`turbo.json`、`pnpm-workspace.yaml`、根 `package.json`、锁文件、构建产物和发布产物。

### 上游差异与优化决策

- 对比官方上游时优先审查功能、数据、安全和运行契约；EchoFlowAI 品牌和已有文档明确的产品模式默认视为有意差异，不因名称或实现形态不同而回退。Node/pnpm 等 Runtime 属于兼容性契约，以机器配置、上游基线和实际构建/关键链路验证为准，不因二开身份自动保留或回退。
- 原本由环境、后台配置、浏览器状态或协议字段决定的值必须继续动态解析；不得把部署域名、Secret 字段、持久化 Key 或公开响应字段仅因品牌替换改成固定值。文档明确的固定产品端点除外。
- 已工作的改进保留；只有明确破坏既有行为或兼容性的部分才局部回退。优化优先修根因、复用现有 helper/标准库/平台能力并控制最小 diff，不为假设需求增加新抽象或依赖。
- 容器镜像优先选择官方或维护成熟的开源镜像。无法维护预构建镜像时允许在启动阶段安装必要系统工具，但应用工具版本必须固定，且不得仅为形式统一替换已验证可用的数据库或缓存镜像。
- 临时 UI 状态覆盖只用于用户不需要交互修改的场景；若用户需要自行展开、折叠或恢复状态，使用正常可持久化状态，不用临时 override 锁住控件。

## 4. 文档治理

- 全仓重复规则只在 `AGENTS.md` 维护。
- 插件 README 只写插件特有事实、证据、风险和下一步；不要重复整套 BaseService、RootLayout、锁、UI、限流、通知、上传、计费等通用规则。
- 插件 README 的“下一步”只保留仍真实存在的产品、技术、验证缺口；已落地内容应移入当前能力/验证或删除。
- 完成设计、开发、浏览器 QA、构建发布或审查修复后，检查是否需要更新 `AGENTS.md` 或对应插件 README；无需更新时在交付说明写明原因。
- 临时材料合并后删除或标记过期；确需保留原始参考、日志或截图时，写明来源、日期、用途和“不作为长期事实源”。

## 5. 工作区与命令安全

- Runtime：Node.js `>=22.20.x <23`，根 `.nvmrc` 固定 `22.20.0`。
- Package manager：根 `package.json` 声明 `pnpm@10.20.0`。
- Workspace 范围以 `pnpm-workspace.yaml` 为准：`packages/*`、`extensions/*`、`packages/@buildingai/*`、`packages/@buildingai/web/*`。
- 公共依赖版本通过 `pnpm-workspace.yaml` 的 `catalog` / `catalogs` / `overrides` 管理；插件通用依赖优先用 `catalog:api` / `catalog:dev` / `catalog:web`。
- pnpm 10+ 不再读取根 `package.json` 的 `pnpm.overrides`、`pnpm.peerDependencyRules`、`pnpm.onlyBuiltDependencies`；这些放在 `pnpm-workspace.yaml`。
- 根 `package.json` 不作为依赖 override 事实源；新增或调整 override 时改 `pnpm-workspace.yaml`，不要再添加 npm/yarn 风格的 top-level `overrides` 镜像。
- 仓库源码、workspace links 和 `node_modules` 应归当前 WSL 开发用户所有；容器命令不得在这些目录留下 root 所有文件。`docker/data` 等数据库或缓存数据卷按容器运行用户单独管理，不纳入全仓统一 `chown`。

除非用户明确要求或当前任务必须，不自动执行：

- `pnpm install` / `pnpm add` / `pnpm remove`
- `pnpm format` / `pnpm lint:fix`
- Docker 启停、PM2 重启、数据库写操作
- 全仓 `pnpm build`、大范围格式化或自动修复

不要手工修改生成/运行目录：`dist`、`build`、`.output`、`.nuxt`、`.temp`、`.turbo`、`public/web/assets`、`packages/client/src-tauri/target`、`packages/client/src-tauri/gen`、runtime storage/uploads、release zip。

## 6. 插件结构与元信息

每个插件通常包含：`package.json`、`manifest.json`、`README.md`、`src/api/index.ts`、`src/api/modules/app.module.ts`、`src/web/main.tsx`、`src/web/routes.tsx`、`vite.config.*`、`tsup.config.ts`、migrations/upgrades（如需要）。

路径术语必须区分：主系统用户入口是 `/apps/<identifier>/*`；extension bundle / local dev base 是 `/extension/<identifier>/*`；Console route 文档需说明是 `consoleRoutes` 相对路径（如 `/console/...`）还是 bundle/dev base 下完整路径（如 `/extension/<identifier>/console/...`）。

必须保持一致：

| 字段 | 要求 |
|---|---|
| identifier | 目录名、`manifest.json.identifier`、`package.json.name`、route `identifier/base`、Vite extension base 一致。 |
| version | `manifest.json`、`package.json`、`extensions/extensions.json` 一致。 |
| engine.buildingai | `manifest.json` 与 `package.json` 一致；字段名是单数 `engine`。 |
| 展示信息 | `manifest.json` 与 `extensions/extensions.json` 的 name、icon、author 信息一致。 |
| installedAt | 本地 registry 中必须是真实 ISO 时间戳，不写占位值。 |

已安装环境的展示信息可能来自数据库 `extension` 记录；修改 manifest、registry 或同版本 upgrade 不会自动改写已有记录。未上线插件可在调整 `0.0.1` upgrade 后显式同步本地数据，已上线插件应通过新版本 upgrade 迁移，并在运行态核对 API 或只读数据库结果。

脚本约束：

- `build:publish` 必须直接串联工具命令，禁止嵌套 `pnpm run ...`。
- `check-types` 按技术栈直接调用 `vue-tsc --noEmit` 或 `tsc -p tsconfig.api.json --noEmit`。
- CLI 工具（vite、tsup、vue-tsc、tsc、eslint、prettier、jest、concurrently、cross-env、rimraf 等）必须在插件本地 dependencies/devDependencies 声明。
- 禁止通过 `node ../../node_modules/...` 或其他 workspace 包的 `node_modules` 越界调用 CLI。
- `templates/extension-starter/` 与 `extensions/simple-blog/` 是模板/示例，也必须符合本节规则。

发布包事实以 `packages/cli/src/commands/extension.js` 的 release allowlist 为准，不以插件 `package.json.files` 为准。

## 7. 后端与安全不变量

- 插件 API 入口用 `src/api/index.ts` 导出 `AppModule`；运行时加载的是 `extensions/<identifier>/build/index.js`。
- 插件实体使用 `@ExtensionEntity()`，不要用普通 `@Entity()` 写插件业务表。
- Web API 用 `@ExtensionWebController()`，Console API 用 `@ExtensionConsoleController()`。
- Controller/Entity extension 装饰器从 `@buildingai/core/decorators` 导入；通用装饰器从 `@buildingai/decorators` 导入。
- 业务 Service 优先继承 `@buildingai/base` 的 `BaseService<T>`；不要重复手写分页、事务包装和通用 CRUD。
- DTO 所有字段必须有 class-validator 装饰器；嵌套对象/数组使用 `@ValidateNested({ each: true })` + `@Type()`；URL 要求 `http`/`https` 且显式协议；字符串内容加长度或枚举边界。
- Controller 不要 catch 后返回 200；业务错误用 Nest HTTP 异常或 `HttpErrorFactory`。
- 外部 AI/HTTP IO 不放进长事务；事务只包裹数据库读写和状态变更。
- 使用悲观锁或 `SELECT ... FOR UPDATE` 的事务写路径设置本地 lock timeout，例如 `SET LOCAL lock_timeout = 3000`。
- 计数器使用 SQL 原子操作，避免 read-modify-write；循环内数据库操作应批量化，避免 N+1。

## 8. AI、Secret、Provider、URL 与计费

| 能力 | 应做 | 禁止 |
|---|---|---|
| 普通 LLM 插件 | 注册 `AiPublicModule`，使用 `PublicAiModelService` 复用主站模型/Provider/Secret。 | 自建模型或密钥管理。 |
| Provider config | 使用 `normalizeProviderConfig`、`resolveProviderEndpointCredential()`、`resolveProviderSecretValue()`。 | 保存 API Key 明文/密文副本或在插件里重复拼接 Secret 字段。 |
| Provider HTTP | 使用 `requestProviderText`、`requestProviderJson`、`testProviderJsonEndpoint`、`normalizeProviderBaseUrl`、`safeJsonParse`。 | 重复手写 fetch、timeout、retry、JSON parse 和 Base URL 校验。 |
| AI 流式响应 | 上游错误、主动中止和流转换失败必须作为失败终态透传；即使 assistant 消息尚未创建，前端也要显示可见错误。 | 只写服务端日志、吞掉 SSE 错误，或让界面停留在无回复状态。 |
| 长文档 AI | 长文档按稳定边界完整分块并合并结果；设置明确的块数/成本上限，超限时失败关闭并提示。 | 静默截取前 N 字后仍宣称完成全量审查。 |
| AI 修改应用 | AI Finding/补丁由后端按稳定对象 ID、当前 revision 和 source hash 校验后应用；内容变化后旧建议失效。 | 前端按标题模糊匹配目标，或提交重建后的整份文档来采纳单条建议。 |
| 外部 URL / 下载 | 保存或下载前用 `assertPublicHttpUrl()`、`resolvePublicHttpUrl()`、`downloadPublicHttpUrl()` 做协议、凭据、本机/内网、DNS、跳转、超时和大小限制。 | 只用 `new URL()` 或裸 axios/fetch 判断安全。 |
| 上传文件 | 用户上传走平台上传和 `fileId`，后端校验上传者、插件归属、大小、MIME/扩展名。 | 只信任 URL/path，或插件重复注册平台 File/Storage 仓储。 |
| 配置输出 | public/admin response 用白名单 serializer 逐字段组装。 | `...config`、`...endpoint`、`...raw` 导致 Secret、Base URL、上游任务和排障字段泄漏。 |
| 计费 | 注册 `ExtensionBillingModule`，使用 `ExtensionBillingService`，业务记录 ID 作为 `associationNo`，事务内传同一个 `EntityManager`；仅在成功终态且取得有效结果/usage 后扣费。 | 对上游 `401/403/429/5xx`、流异常、主动中止或无有效结果的请求扣费；直接改用户余额、重复扣费，或插件直接查询主系统 `AccountLog`。 |
| 退款 | 失败退款检查账务事实；退款失败写入受限 metadata 和时间戳。 | 无真实验证却描述为退款闭环完成。 |

生成类插件用户端必须说明生成对象、扣费时机或价格组、失败退款策略。具体金额以后端 Console 配置为准，前端不硬编码价格。Web API 不返回 `secretId`、Base URL、API Key、上游任务 ID、管理员备注、未脱敏上游响应或 Console 排障字段。

## 9. 队列、通知、数据、Upgrade 与存储

- 长流程默认接主系统 `QueueModule`、BullMQ/Redis 或官方队列能力；插件自定义业务队列可以导入 `QueueModule` 后使用 `BullModule.registerQueue()`、`@InjectQueue()`、`@Processor()`、`WorkerHost` 和 `Job`。
- 异步任务恢复必须有 `onModuleInit` 启动恢复 + `@Cron` 定时 stale 扫描；恢复入队使用事务 + 悲观锁 + CAS，终态不被旧回调/轮询/Webhook 覆盖。
- 入队失败要写业务失败状态并返回可观测错误；付费链路避免重复扣费、重复退款和重复生成产物。
- 高成本 Web 入口优先使用 `ExtensionRateLimitService`；业务策略表的并发/每日额度/价格组不能替代入口防刷限流。
- 通知走 `ExtensionNotificationModule` / `ExtensionNotificationService`；插件只注册场景、提交事件和业务上下文，不重复实现 Web Push、公众号、短信或邮件投递。
- 插件 migration 放 `extensions/<identifier>/src/api/db/migrations/`；数据修复/升级脚本放 `src/api/upgrade/<version>/index.ts`。
- 当前未上线插件可直接调整 `0.0.1` migration/upgrade、实体和默认数据；上线后按 semver 追加 migration/upgrade。
- Seeds 只负责首次安装初始化数据，必须可重复执行并用 `shouldRun()` 或唯一键避免重复。
- 发布随包静态文件放 `storage/static`；运行时上传/生成文件放 `storage/uploads` 等运行目录；大内容存 URL、file ID 或相对路径，不把大文件/base64 放进数据库。

## 10. 前端与嵌入式 UI

- 插件前端入口放 `src/web/main.tsx`，路由优先用 `@buildingai/web-core` 的 `defineRouteOption()`。
- 复杂 Console 管理端使用 `consoleRoutes` + `consoleMenus`。
- HTTP 优先用 `@buildingai/services` 的 `createPluginHttpClients()`；不要手写 `/extension/{id}`、`/api`、`/consoleapi` 前缀。
- 插件用户端默认运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内；不要重复 App Header、账号区、全局统计、营销 Hero、独立侧边栏或完整应用外壳。
- 插件入口使用主系统扩展 RootLayout 时，不要重复创建 `QueryClient` 或 `QueryClientProvider`。
- 通用控件优先使用 `@buildingai/ui/components/ui/*`，用 `cn()` 和 Tailwind 工具类组合；普通布局不长期维护大段手写 CSS。
- 插件 CSS 只负责组件库和工具类难以表达的业务排版、编辑器正文、特殊状态、媒体画布和响应式兜底。
- 主系统主题变量可能是 OKLCH 或直接颜色值；不要默认写 `hsl(var(--primary))` 二次包装。
- 浏览器持久化和 JSON 容错优先使用 `@buildingai/stores` 的 `getLocalStorage()`、`getSessionStorage()`、`safeJsonParse()`、`safeJsonStringify()`。
- 插件 UI 设计沙箱必须在目标插件内以 dev-only route 实现；不得进入生产构建，不得调用真实生成、扣费、上传、provider 或 Secret 链路，不得暴露 raw/provider/secret/Base URL 或未上线 capability。具体 Contract Brief、Design Gallery、方案选择、迁移清理和验证流程见 `.claude/design-workflow.md` 与 `echoflow-ui-workflow` skill。
- 游戏化/经营/叙事互动类插件（如 `echoflow-ai-town`）的玩法 UI、记忆、行动、奖励、无障碍和文案细则写在该插件 README 和测试中；本文件只保留“必须服务业务场景、不要泛 AI chrome、不要普通应用壳”的通用原则。

## 11. 构建、发布与验证

常见验证命令形态：

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> test
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:publish
```

实际命令以目标 `package.json` 为准。单 package 局部改动直接选择最小命令；跨 package、根配置或范围不明确时调用 `/repo-verify`；插件发布/交付前调用 `/extension-release-check`。

根 `pnpm build` 在 Turbo 主构建完成后调用 `scripts/build-extensions.mjs`，按 `extensions/extensions.json` 顺序构建所有本地插件。脚本使用单次 Turbo 调用串行执行缓存化的 `build:publish`，不重复构建已完成的共享依赖，避免多个大型 Vite 构建并发争抢内存；随后强校验每个插件的 `build/index.js`、`.output/public/index.html` 和 `AppModule` 实际导入。任一插件缺少脚本、构建失败、产物不完整或模块无法加载时，predeploy 必须失败，不能带着“插件已启用但运行时跳过”的状态启动。

局部 Extension Web build 修复默认预算：首轮最多读取 8 个直接相关文件、最多 2 批搜索、默认不启动 subagent，最多进行 2 轮“修改 → 目标 build”。目标 build 通过且 diff 仅限预期文件后停止；同一错误连续两轮不变，或需要 install/lockfile、Docker、浏览器、凭据、公共 API 改动时停止并报告 blocker。纯 Vite、Rollup、tsconfig、依赖解析和构建脚本故障不属于 UI 设计任务。

验证原则：

- 先跑窄范围类型检查、lint、测试或构建，再考虑全仓命令。
- docs-only 改动通常不需要产品构建，但要检查路径、事实和路由是否一致。
- 真实外部模型调用、真实 Secret、Webhook、扣费和失败退款属于正式联调；未执行时不得描述为真实闭环已完成。
- 真实环境 smoke 必须 fail-closed：需要登录态、Secret、余额、Redis/Worker 或会触发扣费/外部模型调用时，必须显式要求 token 和生成开关。
- 验证失败或环境阻塞必须写清命令、错误原因和后续条件。
- 主系统出现“启动成功但功能不可用”时，先读 `logs/<year-month>/<day>.log` 和 `logs/pm2/api-error.log` 的完整错误栈，再核对最终 endpoint、HTTP 状态码和脱敏错误代码；之后才判断 Runtime、依赖、Docker 或前端问题。不要仅凭界面现象或单条计费日志归因。
- Secret/Provider 排障不得输出完整密钥；`INVALID_API_KEY`、缺失凭据等上游认证错误应先按配置问题处理，可记录字段存在性或不可逆指纹辅助比对。
- Windows/PowerShell 或 pnpm shell shim 问题要区分环境阻塞与插件代码失败。
- 浏览器 QA 前确认 URL、title、Vite base、端口和业务文案，不能把其他插件 dev server、主系统错误页或浏览器 `data:` 错误页当证据。

## 12. Git、上游与环境

- 开发前按需检查 `git status --short --branch`、`git remote -v`。
- 官方上游只读：`upstream=https://github.com/BidingCC/BuildingAI.git`，`remote.upstream.pushurl` 必须保持 `DISABLED_DO_NOT_PUSH_TO_UPSTREAM`。
- 禁止向官方上游提交、推送或开 PR，除非用户单次明确要求。
- 需要推送时先确认目标远端和分支；`origin` 不等同于官方上游。
- 本地开发优先使用 pnpm：根目录 `pnpm dev:main`，或分别 `pnpm dev:web`、`pnpm dev:api`；插件目录按自身脚本运行。
- Docker 可用于 Postgres/Redis 基础依赖和完整环境验证；Claude 不默认启停 Docker。
- 主系统 Docker、PM2、日志、权限和 AI 请求排障步骤见 `docs/troubleshooting/main-runtime.md`。
- 插件业务配置不放 `.env`，走管理员后台配置或主站 Secret。
- 品牌静态资源变更后至少运行客户端相关构建；发布态 `public/web/assets` 由构建/发布流程刷新，不手工修改。

## 13. 交付检查

- [ ] 改动落在正确边界：插件业务在插件，平台公共能力才改主系统。
- [ ] 未覆盖用户已有改动，未格式化无关文件。
- [ ] DTO、Secret、URL、上传、计费、队列、事务、public serializer 等高风险边界已检查。
- [ ] 插件 metadata、脚本、依赖和 release allowlist 已按需检查。
- [ ] 运行或说明了最小验证命令；失败/跳过有明确原因。
- [ ] 需要更新的 `AGENTS.md`、`CLAUDE.md`、插件 README、包 README 或 skills 已收口；无需更新时说明原因。
