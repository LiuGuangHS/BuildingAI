# EchoFlow BuildingAI 插件开发规范

## 目录

- [核心边界](#核心边界)
- [文档治理](#文档治理)
- [主系统二开决策](#主系统二开决策)
- [官方依据](#官方依据)
- [工作区配置](#工作区配置)
- [插件结构](#插件结构)
- [后端规范](#后端规范)
- [前端规范](#前端规范)
- [Web 与 Console 双入口](#web-与-console-双入口)
- [AI、Secret 与计费](#aisecret-与计费)
- [通知与多渠道](#通知与多渠道)
- [数据、Upgrade 与存储](#数据upgrade-与存储)
- [上传与 URL 安全](#上传与-url-安全)
- [游戏化与记忆](#游戏化与记忆)
  - [首屏与降级](#首屏与降级)
  - [行动与反馈](#行动与反馈)
  - [对话与记忆](#对话与记忆)
  - [内容与 Catalog](#内容与-catalog)
- [构建、发布与验证](#构建发布与验证)
- [Git 与上游](#git-与上游)
- [环境基线](#环境基线)
- [品牌静态资源](#品牌静态资源)
- [当前阶段看板](#当前阶段看板)
- [交付检查](#交付检查)

本仓库是基于 BuildingAI 的 EchoFlow 二开与插件工作区。所有 Agent 和人工改动以本文件为准：主系统是需要持续吸收官方上游更新的二开基座，EchoFlow 业务优先落在插件内；确属平台公共能力的通知、多渠道、登录、计费、Secret、上传、队列和 Console 基础能力，可以按主系统模块边界实现，但必须记录与上游可能冲突的点。

长期规范只维护在 `AGENTS.md` 和各 `extensions/echoflow-*/README.md`。`docs/`、`.agents/`、`.codex/` 和计划文件只作为阶段性分析、执行计划或交接材料；其中形成的最佳实践、边界或任务结论要及时合并回 `AGENTS.md` 或对应插件 README，避免长期维护第二套文档。新发现的更好规范、组件约束、验证方式或边界结论，默认先落到这两个长期入口，再清理临时材料。

## 核心边界

| 范围 | 规则 |
|---|---|
| 插件业务 | 新增独立业务能力优先放在 `extensions/<identifier>/`，EchoFlow 业务插件统一使用 `echoflow-*`。 |
| 主系统能力 | 平台级能力可以改主系统；禁止为了绕过插件能力而 patch 主系统。 |
| 默认可改 | `extensions/<identifier>/`、`skills/`、`templates/`、`.agents/`、`.codex/`、根目录协作文档。`docs/` 只作为临时计划和分析区，不能作为长期规范入口。 |
| 默认谨慎 | `packages/`、`public/web/`、`scripts/`、`docker-compose.yml`、`turbo.json`、`pnpm-workspace.yaml`、根 `package.json`、锁文件和构建产物。 |
| 上游同步 | 拉取或合并官方上游前，先识别 EchoFlow 自有主系统能力，不把通知、多渠道、品牌、登录、计费、Secret、上传、队列和 Console 基础能力误当临时 patch 丢弃。 |

遇到 dirty worktree 时，不回滚非本人改动；如果同一文件已有用户改动，先读懂再顺着改。

## 文档治理

| 范围 | 长期入口 |
|---|---|
| 全仓规范 | `AGENTS.md` 记录主系统二开边界、插件通用规范、上游同步、安全、验证、UI 和文档治理。 |
| 插件事实 | `extensions/echoflow-*/README.md` 记录该插件业务目标、入口、能力状态、数据/队列/计费/AI/上传/通知边界、验证缺口和下一步。 |
| README 收口 | 每个 EchoFlow 插件 README 开头必须有“文档维护规则”，并在正文维护定位、当前能力、入口/职责、关键技术边界、前端嵌入约束、验证命令、已知风险和下一步；不要只把 README 写成营销介绍或零散变更日志。 |
| 临时材料 | `docs/`、`docs/superpowers/`、插件内 `docs/`、设计参考图说明、截图说明、浏览器 QA checklist 和一次性计划只用于阶段性协作；任务收口时只把仍有效的规范、边界、验证证据、设计结论和剩余风险合并回 `AGENTS.md` 或插件 README。 |
| 外部参考缓存 | `.agents/references/`、外部项目快照、参考实现和日志只作为阅读材料或复现证据；不能成为 EchoFlow 长期事实源，也不能在 README 中要求后续维护其原始结构。借鉴后的结论必须改写成 EchoFlow 自己的业务边界、组件约束、安全规则或验证命令。 |
| 清理规则 | 临时材料合并后应删除或明确标记为临时/过期；确需保留原始参考、日志或截图时，必须写明来源、日期、用途和“不作为长期事实源”；不要在交付说明、README 或 AGENTS 中继续引用临时计划作为长期事实来源。 |
| 更新时机 | 发现更好的插件开发规范、组件使用约束、安全边界、验证流程、宿主集成经验或用户端文案规则时，及时更新本文件；发现插件特有经验时更新该插件 README。 |
| 计划粒度 | 插件 README 的后续任务必须能直接驱动开发，至少包含范围、文件、验收、验证命令和阻塞条件；不要只写“优化 UI”“继续完善”“做 smoke”这类不可执行句子。 |

插件 README 的“下一步”只记录仍真实存在的产品、技术、验证缺口和执行顺序；已经通过代码、测试或浏览器验证落地的临时任务要合并进“当前能力/验证”并从待办里移除或标记已落地，避免旧计划长期误导后续开发。每次完成设计、开发、浏览器 QA、构建发布或审查修复后，都要同步检查对应 README 的“当前能力”“开发与验证”“已知风险”“下一步”是否仍准确；如果临时文档、旧计划或外部参考与 `AGENTS.md` / README 冲突，以 `AGENTS.md` / README 为准并立即收口修正。

## 主系统二开决策

| 主题 | 结论 |
|---|---|
| 桌面远程网页壳 | 桌面端构建成远程网页壳是刻意设计：默认站点实时调用线上主站能力，不按离线静态客户端问题处理。只检查默认站点必须是明确 HTTPS 线上地址，不混入本地、内网或带凭据 URL；若未来支持离线桌面端，应作为新模式设计。 |
| 平台公共能力 | 通知、多渠道、登录、计费、Secret、上传、队列和 Console 基础能力可以落在主系统模块；插件只注册场景、提交事件、调用 SDK 和提供业务上下文。 |
| 插件业务边界 | EchoFlow 具体业务默认落在 `extensions/echoflow-*`。主系统不得承载插件私有默认场景、私有模型协议、私有业务表或私有运营内容；发现后迁回插件注册、seed、catalog 或安装流程。 |
| 主系统服务复用 | 主系统公共模块复用复杂服务时，优先导入提供完整依赖并导出该服务的模块；不要在消费模块里重新裸声明 `AuthService`、计费、通知、Secret、上传、队列等带仓储、权限或外部依赖的服务，避免编译通过但 Nest 启动时 DI 缺依赖。 |
| SDK 能力 | 主系统新增或修复插件 SDK 能力时，同步源码导出、公开 exports、`dist` 类型产物和调用方验证；插件不得引用只存在于源码但未进入公开 exports 的符号。 |
| 品牌兜底 | 用户可见的主系统通知、PWA、设置页和站点名 fallback 使用 `EchoFlowAI`。内部协议名、兼容事件名和历史 channel 字符串可保留 `buildingai:*`，除非另有迁移方案。 |
| 二开版本 | EchoFlow 主系统二开版本使用合法 semver 预发布号，例如 `26.1.2-rc.2`；不要使用 `26.1.2rc` 或 `+echoflow.N` 这类升级器不稳定或过长的版本。 |

上游同步前按以下清单复核：确认 `upstream` 只读和 `remote.upstream.pushurl=DISABLED_DO_NOT_PUSH_TO_UPSTREAM`；对主系统 diff 分类为官方恢复、EchoFlow 公共能力、插件私有业务、构建/品牌资产；插件业务如果出现在 `packages/` 或主系统 seed，必须记录平台公共性原因，没有公共性就迁回插件；合并后运行通知边界测试、SDK build、客户端 build 和相关插件 check-types/build。

主系统二开版本与迁移保持单线递增：根 `package.json.version`、主系统 migration 文件名和升级验收记录使用同一合法 semver，例如 `26.1.2-rc.2`；升级器必须能从 `timestamp-version-description.js` 文件名完整解析预发布版本。每个 rc 版本只保留一个主系统迁移入口，未发布前发现同一能力拆出多个连续迁移时合并到当前 rc 迁移，不再追加空转版本。已在本地 Docker 跑过旧文件名但未推送服务器时，优先改源码版本和文件名，再用一次性 SQL 修正本地 `migrations_history` 记录；不要为了本地历史制造永久兼容迁移。

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

## 工作区配置

`pnpm-workspace.yaml`、根 `package.json`、`pnpm-lock.yaml`、`turbo.json` 属于谨慎修改文件；变更前必须理解其影响范围并在提交说明里写清原因。

| 主题 | 规则 |
|---|---|
| catalog 版本 | 公共依赖版本通过 `catalogs`（`api`、`dev`、`web`）统一管理。插件 `package.json` 必须用 `catalog:api`/`catalog:dev`/`catalog:web` 引用，禁止硬编码版本号或在插件里维护独立版本。 |
| catalog 新增 | 新增 catalog 条目前先检查是否已有同名条目；多个插件需要同一新依赖时，先加 catalog 再让插件引用；单插件私有依赖（如 echoflow-image 的 `tldraw`、echoflow-contract-generation 的 `docx`、`platejs`）可直接硬编码版本，不进 catalog。 |
| catalog 分组 | `catalog:api` 放 NestJS/BullMQ/后端运行时依赖；`catalog:web` 放 React/Vue/前端 UI/构建依赖；`catalog:dev` 放类型检查、测试、格式化、CLI 工具等跨前后端的开发依赖。`vite` 同时出现在 `catalog:dev` 和 `catalog:web` 时版本保持一致。 |
| pnpm 配置位置 | pnpm 10+ 不再读取根 `package.json` 的 `pnpm.overrides`、`pnpm.peerDependencyRules`、`pnpm.onlyBuiltDependencies` 字段，这些必须全部在 `pnpm-workspace.yaml` 中维护；新增或调整时写清原因和预期移除时机。根 `package.json` 顶层 npm 标准 `overrides` 字段 pnpm 仍读取，但新条目优先写入 `pnpm-workspace.yaml` 统一管理。 |
| overrides 强制版本 | `pnpm-workspace.yaml` 的 `overrides` 会全局强制版本（例如 `vite: 8.0.0`、`zod: ^4.3.6`），添加时必须注释说明原因（主系统要求、安全修复、peer dep 冲突等），并在主系统版本升级后复核是否仍有必要。overrides 版本与对应 catalog 版本不一致时，overrides 生效，会覆盖 catalog 版本——此时需同步更新 catalog 或注释说明差异原因。 |
| lockfile | `pnpm-lock.yaml` 必须与 workspace 所有 `package.json` 一致；新增/升级依赖后必须运行 `pnpm install --no-frozen-lockfile` 更新锁文件，不提交过时的 lockfile。 |

常见故障：
- `ERR_PNPM_CATALOG_NOT_FOUND`：插件用了 `catalog:xxx` 但 pnpm-workspace.yaml 里没有对应条目，补 catalog 即可。
- `ERR_PNPM_OUTDATED_LOCKFILE`：lockfile 与 package.json 不同步，跑 `pnpm install` 重新生成。
- `The "pnpm" field in package.json is no longer read by pnpm`：说明根 package.json 还残留 `pnpm.*` 字段，必须迁移到 pnpm-workspace.yaml。

## 插件结构

| 项目 | 要求 |
|---|---|
| 创建 | 优先用 `pnpm extension:create` 或 `pnpm buildingai extension:create`，会基于 `templates/extension-starter/` 生成骨架。 |
| 命名 | 目录、`manifest.json.identifier`、`package.json.name`、`defineRouteOption({ base, identifier })`、`defineExtensionViteConfig(packageJson)` 必须同名。 |
| 登记 | 本地插件必须写入 `extensions/extensions.json`，手工复制或恢复插件后同步检查登记；登记的 identifier、name、version、icon、author 必须与 `manifest.json` 一致，避免本地插件列表展示旧名称或旧图标。 |
| 版本 | `manifest.json` 与 `package.json` 版本一致；未上线插件首版修复合并回 `0.0.1` migration/upgrade，不制造无意义版本号；上线后按 semver 约定升 patch/minor/major。 |
| 依赖 | 插件 `package.json` 必须声明源码、`scripts/*.mjs`、`tests/**/*`、`vite.config.*`、`tsup.config.*`、`eslint.config.*` 等运行、构建、测试路径直接 import/require 的包，不依赖根项目或传递依赖侥幸解析；清理模板遗留但源码不再使用的 `@buildingai/*` 和第三方依赖。 |
| 示例 | `simple-blog`、`extension-starter` 是官方示例/模板，不作为 EchoFlow 业务插件命名或改造对象。 |
| 预留 | reserved/experimental 能力可保留，但不能进入默认运行路径，不能呈现为已上线能力。 |
| engine 字段 | 使用单数 `"engine": { "buildingai": ">=x.y.z" }`（这是 BuildingAI 扩展自定义字段，不是 npm 标准 `engines`）。主系统由 `@buildingai/utils` 的 `checkVersionCompatibility()` 读取，用于安装时平台版本兼容检查；`manifest.json` 和 `package.json` 的 `engine.buildingai` 必须一致。 |

三处元信息一致性要求：

| 字段 | manifest.json | package.json | extensions.json | 一致性要求 |
|---|---|---|---|---|
| identifier | ✅ | ✅(name) | ✅ | 必须完全相同且等于目录名 |
| version | ✅ | ✅ | ✅ | 必须完全相同 |
| engine.buildingai | ✅ | ✅ | — | manifest 与 package 必须相同 |
| name | ✅ | — | ✅ | 必须相同（用户可见展示名） |
| icon / author.avatar / author.name | ✅ | — | ✅ | 必须相同 |
| description | ✅ | 可偏技术视角 | 可偏市场/用户视角 | 方向一致即可，允许按场景差异化措辞 |
| installedAt | — | — | ✅ | 由安装流程写入真实 ISO 时间戳，禁止手工写占位值 |

脚本命令约定与约束：

| 脚本名 | 用途 | 约束 |
|---|---|---|
| `dev` | 并行启动 web + api 开发服务 | 可嵌套 `pnpm dev:web`/`pnpm dev:api`（concurrently） |
| `dev:web` / `dev:api` | 单独启动前端/后端开发服务 | 直接调用 vite/tsup |
| `build:clean` | 清理 build/.nuxt/.output/.temp | 直接调用 rimraf |
| `build:web` / `build:api` | 单独构建前端/后端 | 直接调用 vite/tsup |
| `build:publish` | 发布前完整构建（清理 + web + api） | **必须直接串联工具命令**，禁止嵌套 `pnpm run ...`，避免 Windows/Corepack 命中不同 pnpm shim 导致本地验证失败 |
| `check-types` | 类型检查 | 直接调用 `vue-tsc --noEmit` 或 `tsc -p tsconfig.api.json --noEmit`，根据插件技术栈选择 |
| `test` | 单元/集成测试收口脚本（含类型检查） | 直接调用测试运行器，禁止嵌套 `pnpm`；允许 `vue-tsc --noEmit && jest ...` 这种串行形式 |
| `lint` / `lint:fix` | 代码检查/自动修复 | 直接调用 eslint |
| `format` | 格式化 | 直接调用 prettier |

❌ 反模式（禁止）：
```json
"build:publish": "pnpm build:clean && pnpm build:web && pnpm build:api",
"check-types": "node ../../node_modules/vue-tsc/bin/vue-tsc.js --noEmit",
"test": "node ../../packages/api/node_modules/jest/bin/jest.js --runInBand"
```
✅ 正确写法：
```json
"build:publish": "rimraf build .nuxt .output .temp && vite build && cross-env NODE_ENV=production tsup",
"check-types": "vue-tsc --noEmit",
"test": "jest --runInBand --passWithNoTests"
```

脚本中的 CLI 工具（vite、tsup、vue-tsc、tsc、eslint、prettier、jest、concurrently、cross-env、rimraf 等）必须在插件本地 `devDependencies` 声明，并通过 `catalog:dev`/`catalog:web`/`catalog:api` 引用版本；禁止通过 `node ../../node_modules/<pkg>/bin/<cli>.js`、`node ../../packages/<pkg>/node_modules/<cli>` 等相对路径越界调用根 node_modules 或其他 workspace 包的 CLI，也禁止依赖传递依赖侥幸解析。

EchoFlow 业务插件 devDependencies 最小基线（`catalog:*` 版本由 pnpm-workspace.yaml 统一管理）：

```json
{
  "@buildingai/eslint-config": "workspace:*",
  "@buildingai/typescript-config": "workspace:*",
  "@buildingai/web-types": "workspace:*",
  "@types/react": "catalog:web",
  "@types/react-dom": "catalog:web",
  "concurrently": "catalog:dev",
  "cross-env": "catalog:dev",
  "eslint": "catalog:dev",
  "eslint-plugin-react-refresh": "^0.4.26",
  "globals": "^16.5.0",
  "prettier": "catalog:dev",
  "rimraf": "catalog:dev",
  "tsup": "catalog:dev",
  "typescript": "catalog:dev",
  "vite": "catalog:web"
}
```
使用 Vue 技术栈（vue-tsc）时加 `"vue-tsc": "catalog:dev"`；使用 jest 时加 `"jest": "^29.7.0"`、`"ts-jest": "^29.3.1"`、`"@types/jest": "^29.5.14"`、`"ts-node": "^10.9.2"`；使用 Node 内置 `node --test` 的插件可以不加 jest/ts-jest。

**模板合规强制规则**：`templates/extension-starter/` 和 `extensions/simple-blog/` 作为脚手架和官方示例，必须始终符合本节所有规则；规范变更（脚本约定、依赖基线、字段要求）必须同步更新模板和示例，禁止出现"规范写了但模板没改"导致新插件从脚手架就违规的情况。

跨插件重复的测试辅助可放在 `extensions/test-utils/`，该目录是可跟踪的测试目录，`.gitignore` 必须显式放行；仅承载 Node 测试、静态边界测试和测试 helper，不能放业务运行时代码；插件 runtime 不能反向依赖该目录。

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
| 依赖收口 | 插件依赖与 devDependency 必须在源码或配置链路中找到实际用途；像 `vite-tsconfig-paths`、`babel-plugin-react-compiler` 这类模板残留，如果只是在 `package.json` 里挂着而没有被 `tsconfig` / `vite` / `test` 引用，就应清理。 |
| Provider HTTP | 上游模型 JSON/text 请求优先复用 `@buildingai/extension-sdk` 的 `requestProviderText` / `requestProviderJson` / `testProviderJsonEndpoint` / `normalizeProviderBaseUrl` / `safeJsonParse`；外部 http(s) 二进制资源下载优先复用 `downloadPublicHttpUrl()` 的 DNS 绑定、跳转、超时和大小限制；插件只保留协议组装、业务错误文案、能力映射、MIME/扩展名和业务文件规则。 |
| SDK Helper 引用 | 插件内多个文件需要 `safeJsonParse`、`buildDefinedWhere`、URL 校验、provider HTTP、下载器、限流、计费或通知 helper 时，调用方直接从 `@buildingai/extension-sdk`、`@buildingai/extension-sdk/utils/pure` 或主系统公开包导入；不要通过某个插件薄封装文件顺带转口，避免源码可用但公开导出或类型产物断裂。纯解析、序列化、view-model 或测试边界文件优先用 `utils/pure`；已经依赖 Nest/DB/AI 模块的业务 service 可以继续用 SDK 根入口，不为 import 美化制造无意义 churn。 |
| 模型/配置 JSON 解析 | LLM 或 provider 返回文本、插件前端可编辑 JSON 配置字段需要解析结构化 JSON 时，后端/provider 侧使用 `@buildingai/extension-sdk` 公开的 `safeJsonParse`；纯解析、序列化和 view-model 类文件优先从 `@buildingai/extension-sdk/utils/pure` 引入纯工具，避免为了 JSON/where helper 拉起 Nest/DB/低层 AI provider；Web 侧使用 `@buildingai/stores` 的 `safeJsonParse`。直接 `JSON.parse` 只保留在隔离测试、迁移、脚本或确需原生语法错误且有边界测试覆盖的场景，业务 prompt、审计快照和 provider payload 的 `JSON.stringify` 可保留。 |
| 依赖声明 | 插件源码直接 import 的运行时包必须在该插件 `package.json` 声明；类型 import 也要声明提供该类型的包。删除模板残留依赖时同步补 manifest 边界测试，避免只在根 workspace 或其他插件依赖里偶然可用。 |
| Service 继承 | 业务 Service 优先继承 `@buildingai/base` 的 `BaseService<T>`，复用分页、事务包装、通用 CRUD 等已有能力；Controller 优先继承 `BaseController`；不要重复手写分页、`manager.transaction` 包装或错误处理模板。 |
| 错误处理 | 业务校验失败统一使用 NestJS HTTP 异常（`BadRequestException`、`NotFoundException`、`ForbiddenException` 等），禁止 `throw new Error()` 返回 500；Controller 层禁止用 try/catch 吞掉异常返回 200，应让异常冒泡到全局过滤器。 |
| DTO 验证 | 所有 DTO 字段必须有 class-validator 装饰器验证；嵌套对象/数组使用 `@ValidateNested({ each: true })` + `@Type()`；字符串 URL 字段用 `@IsUrl({ protocols: ["http","https"], require_protocol: true })`；文本内容字段加 `@MaxLength` 防止超长输入；禁止只用 `@IsString()` 而无长度/格式约束。 |

### 事务与并发控制

| 主题 | 规则 |
|---|---|
| 悲观锁超时 | 所有使用 `SELECT ... FOR UPDATE`、`manager.transaction` 包裹的写操作，事务开头必须执行 `await entityManager.query('SET LOCAL lock_timeout = 3000')`，定义文件级常量 `const LOCK_TIMEOUT = 'SET LOCAL lock_timeout = 3000'` 避免魔法字符串散落。 |
| 任务恢复 | 异步任务（队列、Worker、定时任务）的恢复路径必须在事务内使用悲观锁 + CAS（Compare-And-Swap）二次校验：先 `SELECT ... FOR UPDATE` 锁定记录，再检查 `status === 'PROCESSING' AND updatedAt < staleThreshold`，确认是自己抢到后才更新 `updatedAt` 并入队；防止多实例并发重复入队。 |
| 处理锁分离 | "处理中锁"（防止并发处理同一记录）与"恢复锁"（判定任务是否 stale 需要恢复）必须使用不同超时时间；处理锁通常 30 分钟，恢复锁通常 5 分钟，不能共用同一阈值。 |
| 原子计数 | 计数器增减（浏览量、分类文章数、关系值等）必须使用 SQL 原子操作：`increment({ id }, "field", 1)` 或 `set({ field: () => 'GREATEST(field - 1, 0)' })`；禁止先 `find` → 内存改值 → `save` 的 read-modify-write 模式。 |
| N+1 查询 | 循环内逐条数据库操作必须改为批量 SQL；批量更新分类计数使用 `CASE WHEN id = ? THEN ? ... ELSE 0 END` 单 SQL；关联列表使用 JOIN 或 IN 查询一次性加载；聚合统计使用 `GROUP BY` 替代多次 `COUNT`。 |
| 事务范围 | AI 调用、HTTP 请求等外部 IO 不得放在长事务内；事务只包裹数据库读写和状态变更；外部调用失败后在事务外处理退款/补偿。 |

### 队列与任务恢复

长流程默认接主系统 `QueueModule`、BullMQ/Redis 或官方队列能力。当前主系统 `QueueModule` 只统一 BullMQ 根配置和默认队列，并导出 `BullModule`；插件自定义业务队列可以在导入 `QueueModule` 后使用 `BullModule.registerQueue()`、`@InjectQueue()`、`@Processor()`、`WorkerHost` 和 `Job` 类型。若未来主系统提供插件队列门面，再迁移到公开 SDK/模块导出；在此之前，不把这种官方 BullMQ 装饰器用法误判为未复用。图像、合同、星盘等付费生成链路不保留进程内 `setTimeout` fallback；入队失败要写业务失败状态并返回可观测错误。

任务恢复必须实现 `onModuleInit` 启动恢复 + `@Cron` 定时 stale 扫描双路径：启动时扫描 PROCESSING 且锁超时的记录重新入队，运行时每 N 分钟定期扫描 stale 任务；恢复入队使用事务+悲观锁+CAS 防止重复入队；Webhook 回调、手动刷新、轮询完成等异步写回路径同样要在锁内校验当前状态，已终态记录不被旧结果覆盖。

### 限流与错误处理

高成本 Web 入口的短窗口请求限流优先复用 `@buildingai/extension-sdk` 的 `ExtensionRateLimitService`，由插件模块注入主系统 Redis 能力；生成、提示词优化、AI 问答、导出或批量操作等入口至少设置秒级和分钟级窗口。业务策略表里的并发数、每日额度或价格组只负责业务资格与成本控制，不能替代入口防刷限流；不要在插件里新建进程内 Map/计时器限流服务。

## 前端规范

| 主题 | 规则 |
|---|---|
| 入口 | 前端入口放 `src/web/main.tsx`。 |
| 路由 | 优先用 `@buildingai/web-core` 的 `defineRouteOption()`；复杂 Console 管理端使用 `consoleRoutes` + `consoleMenus` 多页面。 |
| HTTP | 优先用 `@buildingai/services` 的 `createPluginHttpClients()`，Web 调 Web API，Console 调 Console API。 |
| Service | 建议分为 `src/web/services/web/`、`src/web/services/console/`、`src/web/services/types/`。 |
| React Query | 插件入口和自建 `queryClient` 优先从 `@buildingai/services` 使用已公开导出的 `QueryClient` / `QueryClientProvider`；`useQuery`、`useMutation` 等 hook 若主系统尚未公开再导出，可继续从 `@tanstack/react-query` 导入，不为此 patch 主系统。 |
| 浏览器持久化/JSON | 插件需要 `localStorage` / `sessionStorage` 或 Web 运行时 JSON 容错解析时，优先从 `@buildingai/stores` 使用 `getLocalStorage()` / `getSessionStorage()` / `safeJsonParse()` / `safeJsonStringify()`；Console JSON 配置编辑器也走共享安全解析，不在插件运行时代码里重复手写存储适配和裸 `JSON.parse` 容错。 |
| UI | 通用控件优先使用 `@buildingai/ui/components/ui/*` 的 `Button`、`Card`、`Input`、`Textarea`、`Select`、`Tabs`、`Badge`、`Label`、`Checkbox`、`Switch`、`Alert`、`Progress`、`Skeleton`；普通表单字段标签和 checkbox/radio 复合行都使用系统 `Label`，通过稳定 `id` / `htmlFor` 保留整行点击语义；同一复合控件可能在页面、弹窗或列表重复渲染时，用 React `useId()` 生成实例前缀，避免重复 DOM id。不要用裸 `<label>`/`<span>` 另写一套字号和状态。布局和状态优先用组件 `className`、`@buildingai/ui/lib/utils` 的 `cn()` 和 Tailwind 工具类组合。 |
| CSS | 插件 CSS 只负责组件库和工具类难以表达的业务排版、编辑器正文、特殊状态、媒体画布和响应式兜底；普通面板、按钮、Tabs、Drawer、Badge、表单、进度、空态、报告卡和网格优先用系统组件、`className`、Tailwind 工具类和 `cn()` 组合，不注入内联 `<style>`，不长期维护大段手写 CSS，也不要重写主系统组件边框、焦点环、禁用态、尺寸和主题色。 |
| 主题 | 主系统变量可能是 OKLCH 或直接颜色值；不要默认写 `hsl(var(--primary))` 二次包装。 |
| 卡片 | 顶层工作区可用系统 `Card` 分区，不在 Card 内再堆 Card。 |

用户端首页直接展示核心功能，不做营销落地页或“进入工作台”中间页。生成、画布、游戏化和经营类插件应在首屏给出可操作工作区；桌面端优先左侧输入/任务、右侧结果/历史，移动端优先单任务视图和页面内紧凑 Tab。

现代 AI 插件的视觉重点是业务智能、状态可信和结果可操作，不是完整应用外壳或泛 AI 装饰。优先用模式引导、素材/上下文质量、异步进度、扣费/退款事实、结果复用和结构化输出体现智能感；避免大 Hero、独立导航、用户头像、全局统计、重复余额中心、大面积发光渐变、口号式 AI 文案和脱离宿主的整页背景。经营、游戏化和画布类插件的外层视觉应服务具体题材和玩法场景，例如小镇、影棚、画布或仪表台，不使用泛 AI 紫色发光 chrome；按钮、徽章、标签和 HUD 文案默认不做非零 `letter-spacing` 拉伸，除非现有设计系统明确要求。

基础 UI 组件、插件 RootLayout、loading、toast、空状态和错误页属于每个插件首屏都可能加载的路径，不要为这些常驻能力静态引入 `lucide-react` 全量或动态图库；优先使用 CSS spinner、轻量状态符号或明确静态图标。Console 菜单如需动态图标，应在主系统图标组件层做白名单或静态映射，避免每个插件发布产物生成大量图标碎片或把大图标 chunk 预加载到用户端首页。

插件 Web 用户端默认运行在主系统 `/apps/{identifier}` iframe 和扩展 RootLayout 内，外层已经提供主导航、账号、主题、全局布局和页面空间。插件内部应做嵌入式业务面板，不重复 App Header、用户头像/账号、全局统计、营销 Hero、独立侧边栏或完整应用外壳；仅展示当前业务需要的上下文，如当前档案、生成依据、价格组、失败退款、任务状态和结果操作。插件内容宽高要适配主系统可用区域，避免固定整页大壳、过宽居中容器和 `100vh` 背景造成与主系统割裂。

插件用户端两列或多列工作区默认按内容顶部对齐，输入面板、生成表单、筛选面板和结果摘要卡不应为了追平右侧长内容而使用 `self-stretch` 或默认拉伸成整页高度；需要左右等高的场景必须是业务上确有并排对照意义，并在 README 说明原因。嵌入式插件的美观重点是密度、留白和信息层级稳定，而不是把宿主可用区域硬填满。

插件前端入口使用主系统扩展 `RootLayout` 时，不要再在插件 `main.tsx` 外层重复创建 `QueryClient` 或 `QueryClientProvider`；查询默认配置、认证跳转、错误处理和宿主布局应保持由主系统 RootLayout 统一提供。页面组件内部可以继续使用 `useQuery`、`useMutation` 和 `useQueryClient`。

扩展 RootLayout 的宿主辅助查询必须支持静默失败，例如刷新用户信息、扩展详情、站点标题或装饰数据；这些请求失败不能在插件用户端首屏弹出全局 Network Error toast，插件应继续展示自己的可玩首屏、服务状态或业务降级说明。

异步生成类插件在无可用模型、未开放、配置缺失或服务暂停时，用户端可以保留工作台信息结构和信任说明，但生成表单的输入、上传、模板、参数和提交控件必须整体禁用或只读，避免用户误以为可以填写后立即生成；文案应说明进入队列、非实时完成、扣费时机和失败退款事实。此类状态应优先由 Web 公开状态接口提供，例如 `canGenerate`、`unavailableReason` 和公开价格组，不向用户端返回模型 ID、Provider、Secret、Base URL、上游任务或 Console 排障字段；前端所有生成、再生成、模板和参数入口应复用同一状态，避免单点漏禁用。

用户端文案避免泛化“AI 风”堆砌。生成类插件把智能感落到分析范围、扣费规则、失败退款、上下文来源和结构化结果；Console 可保留模型、Provider、AI 等运维术语。
插件公开元信息会出现在应用列表、安装记录或市场入口，也属于用户第一印象；用户端插件的 `manifest.json`、安装记录 seed/upgrade、package 描述和市场文案应使用业务/玩法/工具语境，不要把名称写成泛 AI 应用、AI 助手或 AI 趣味玩法，除非该入口面向 Console 运维而非最终用户。

设计/实现过程中的草稿计划、参考图、浏览器 QA checklist、临时截图说明和一次性分析文档只作为执行辅助；交付前把仍有效的规范、边界、验证结论、设计取舍和剩余风险合并进 `AGENTS.md` 或对应插件 `README.md`，并清理本人创建的临时脚本和临时文档，避免长期维护第二套散落文档。参考图可以保留为插件静态发布资产或 README 事实的一部分，但不能成为 README 之外的长期任务看板。插件 README 应记录该插件的业务边界、AI/计费/安全能力状态、前端嵌入约束、验证命令和当前缺口；根 `AGENTS.md` 只沉淀跨插件通用规则。浏览器 QA 检查 React lazy route 或 Suspense 页面时，必须等待 loading/skeleton 结束并确认业务标题/关键文案出现后再判断视觉状态；短暂骨架态不能当作白屏或通过证据。浏览器 QA 还必须先用 HTTP 或页面标题确认当前端口服务确实属于被测插件，例如根路径、HTML title、Vite base 和业务文案都匹配 `identifier`；不要把其他插件占用的 dev server、主系统登录跳转错误页或浏览器 `data:` 错误页当作当前插件的视觉证据。

Docker 验证若主站 node 容器长时间未监听端口，先区分业务启动错误和宿主挂载阻塞：检查 PM2 error 日志、API 进程状态、`/proc/<pid>/wchan` 和 `/proc/net/tcp`。若进程处于 `D` 状态且 `wchan` 为 `p9_client_rpc`，这是 Docker Desktop / WSL 访问 Windows 工作区挂载的内核等待，不能归因于插件业务逻辑或 Nest DI；应记录为环境验证阻塞，待 Docker/WSL/文件挂载恢复后再做浏览器 E2E。

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
| Provider Config | 普通 LLM 插件通过 `PublicAiModelService` 间接复用主站 Provider/Secret 归一化；只有图像、视频等协议接入点配置层才直接使用 `normalizeProviderConfig`、`resolveProviderEndpointCredential()` 等 SDK helper。 | 普通业务 service 自己拉取 Provider config、重复维护 flatten helper，或绕开主站模型、Provider 和 Secret。 |
| Secret | 图像、视频模型接入点只保存 `secretId`、`secretName`、可选 `baseUrlOverride`、优先级、超时、重试和启用状态；运行时凭据解析统一使用 `resolveProviderEndpointCredential()`。 | 保存业务 API Key 明文、密文副本或写入 `.env`、源码、前端包，或在插件里重复拼接 Secret 字段和 Base URL。 |
| Base URL / Provider HTTP | 图像、视频接入点保存、测试和运行时统一复用 `@buildingai/extension-sdk` 的 `normalizePublicHttpUrl` / `assertPublicHttpUrl` / `resolvePublicHttpUrl`、provider HTTP client 和 `downloadPublicHttpUrl()`。 | 插件内重复维护 Base URL 协议、凭据、本机或内网判断，或为普通 provider JSON/text/二进制下载重复手写 fetch、timeout、retry、JSON parse、DNS 绑定请求。 |
| 配置输出 | 模型配置、接入点和管理端配置对外返回必须用白名单映射，逐字段组装允许展示的 public/admin 视图；不要直接 `...config`、`...resolved` 或 `...endpoint`，避免历史字段如 `apiKeyMasked`、旧兼容键或内部排障字段泄漏到响应里。 | 依赖对象展开让旧字段“顺手”穿透到 console/web response，或把历史字段当作长期事实继续输出。 |
| 结果/文件 URL | Provider 返回的媒体结果 URL、非平台上传文件 URL 或即将进入解析/下载/持久化的外部 http(s) URL，必须用 `assertPublicHttpUrl()` 或 `downloadPublicHttpUrl()` 完成 DNS 公网校验；只允许已通过平台 `fileId`、上传者、插件归属、大小和 MIME 校验的 `/uploads/` 路径跳过外部 DNS 校验。 | 只用 `new URL()` 或 `normalizePublicHttpUrl()` 保存 provider 结果 URL、合同文件 URL、Webhook 回调资源或外部下载地址。 |
| 媒体模型 | 图像、视频采用插件内置固定模型目录；管理员只配置启用、展示名、默认参数、模型级计费和接入点。 | Console 手工新增协议模型、供应商或覆盖能力矩阵。 |
| 媒体协议适配 | 固定模型 catalog 可以记录供应商/协议差异，但活动运行层应收敛到通用协议客户端或清晰的协议适配层；退役单供应商旧客户端时，同步删除代码和测试、把默认 Base URL 等公共常量迁入 catalog/协议层作为唯一来源，并用 README/manifest 边界测试防止旧客户端名或重复默认值继续作为当前事实出现。 | 删除旧代码后 README 仍宣传旧客户端，让模型配置 service 继续 import 单供应商默认参数来绕过通用协议层，或在 service/client 里重复硬编码 provider 默认 Base URL。 |
| 能力矩阵 | capability 由协议适配层真实支持反推；Responses 生图不暴露 mask，Images 纯生成不暴露图生图/mask/多参考图。 | 前端展示尚未实现的编辑能力。 |
| 计费 | 注册 `ExtensionBillingModule` 并使用 `ExtensionBillingService`，业务记录 ID 作为 `associationNo`，事务内传同一个 `EntityManager`；扣费/退款事实检查统一用 `ExtensionBillingService.hasBillingLog()`。 | 直接修改用户余额、重复扣费，或在插件里直接注入/查询主系统 `AccountLog`。 |
| 退款 | 失败退款检查账务事实；退款失败写入业务记录 metadata 或脱敏 raw metadata，如 `metadata.refundError`、`rawResponse.metadata.refundError` 和 `refundFailedAt`。 | 把失败退款描述为已闭环但没有真实验证。 |

付费生成入口必须在用户端说明分析/生成对象、扣费时机或价格组、失败退款策略。具体金额以后端 Console 配置为准，前端不得硬编码价格。

用户端 API 不返回 `secretId`、Base URL、API Key、上游任务 ID、管理员备注、未脱敏上游响应、管理员接入点详情或模型计费规则快照。图像/视频 Web Controller 必须走 public serializer。
前端类型同步区分 Web / Console 记录：用户端 service 和组件只使用 public 字段，Console 类型再扩展 `userId`、`taskId`、`rawRequest`、`rawResponse`、`baseURL`、`adminRemark` 等排障字段。
AI 修复重试、格式修复结果、失败归因、退款异常、Provider 排障原因等审计字段只进入 Console 类型、Console 详情和内部 metadata；Web serializer、Web service 类型和 `smoke:web` 必须显式断言这些字段不出现在用户端公开报告、生成记录或任务详情里。
生成类插件若支持继续追问、再生成或基于历史记录生成，必须把来源记录的用户可见摘要、问题、行动项、风险提醒等白名单上下文写入业务 request payload 或队列 payload，并进入模型 prompt；不要只把来源记录写进 metadata 或前端状态供展示。
生成类插件若提供用户反馈入口，不应只做不可解释的点赞/差评按钮；至少要允许一条短备注或结构化原因进入受限 metadata，并在后续追问、再生成或同类报告时按白名单摘要进入 AI 上下文。反馈 UI 要说明它影响后续质量参考，Web API 只返回用户可见反馈，不暴露管理员备注、原始请求或上游响应。

生成类插件若在 UI 展示判断依据、追问建议、行动项、风险提醒或生成上下文，复制文本、导出文本、通知摘要和 `resultText` 等离开页面的消费链路也必须保留核心 AI 结构；不要只复制 summary，导致插件亮点在分享、搜索和历史检索里丢失。
生成类插件若展示 AI 置信度、风险等级、质量等级或类似核心判断标签，用户端、Console、复制/下载、通知摘要和 README 必须使用同一套业务术语；不要在页面写“可信”、导出写“置信”、Console 又换一套表达，避免用户把同一条模型依据理解成不同判断强度。
生成类插件若把结构化 AI 结果作为核心能力，Console 诊断也应展示对应的公开结构化字段，例如标题、摘要、评分、关键词、幸运锚点、判断依据、洞察段落、行动项、风险提醒、复盘清单、继续追问或失败归因；结果契约应要求模型同时给出非空标题、非空摘要、可解释依据、可执行行动和风险提醒，不能只返回空壳、摘要或泛化建议。报告段落不能只满足数量，必须覆盖洞察、机会、风险和行动这类可消费结构。行动项不应只是短句列表，推荐结构化为具体行动、原因和执行时间窗；风险提醒推荐结构化为风险标题和边界说明。判断依据来源必须来自真实输入上下文，例如用户档案、当前状态、用户问题、问题质量、目标对象、追问来源或用户反馈，不能接受模型编造的来源标签；每条判断依据都应包含低/中/高等置信度等级，不在后端或前端补默认置信度，避免把模型没有声明的判断强度伪装成可信依据；即使来源文本包含白名单词，也必须拒绝“未提供、缺失、未知、猜测、推测、假设、虚构、编造”等不可用上下文。面向用户的 AI 结果不得使用“必然、注定、保证、一定会、绝对会、必赚、稳赚”等确定性承诺，尤其是运势、合同、经营建议、健康、投资、关系或法律相关内容；这些内容应进入结构异常失败和退款/排障链路，而不是在前端弱化展示。复盘清单、行动项或风险验证点必须能追溯到本次结果的判断依据、行动建议或风险提醒；继续追问也必须是能继续推进业务判断的问题或延展请求，不把“继续努力”“保持觉察”这类口号当作可用追问。Console 可以保留用户 ID、模型 ID、Provider ID 等排障字段，但不要为了展示 AI 亮点读取原始请求、原始上游响应、Secret 或未脱敏 payload。
生成类插件若在用户端展示分数、置信度、指数、评分卡或其他量化判断，这些值必须由模型结构化结果或可审计规则明确提供，并进入结果契约与测试；不得在 normalize、serializer 或前端空态里补一个看似真实的默认分，避免把缺失 AI 结论伪装成可消费判断。
生成类插件若把判断依据、追问建议、行动项或风险提醒作为核心亮点，模型结果 schema 必须强制这些关键字段的最小可用数量和非空内容；不要只在 prompt 里要求或在前端做空态兜底，否则空壳报告会绕过失败退款与质量审查。
生成类插件若在用户端展示问题质量、上下文完整度、可复盘程度等 AI 输入质量提示，后端也必须构造同源质量上下文并进入 request payload 或 prompt；不要只做前端装饰性评分。
用户端 AI 相关文案必须落到业务语境、玩法语境和可验证规则，例如镇务参谋、今日计划、居民回复、分析对象、扣费时机、失败退款或规则补位；用户端额度提示、付费确认和生成确认也必须使用业务语境和玩家动作，不暴露管理员配置、Provider、模型生成、上游任务或 Secret 细节，也不要把主按钮写成“继续”“确认使用”“开始生成”等泛确认文案。额度或付费说明也不要只写“确认后可能消耗额度”，应写明玩家动作和业务对象；避免“智能建议”“AI 黑科技”“一键生成奇迹”等泛 AI 风营销表达。Console 可保留模型、Provider、AI、fallback 等运维术语。用户端事件审计、行动日志或结果说明不得使用“生成内容”“模型输出”“fallback”“本地规则”等工具或运维措辞，应写成参谋参与、规则补位、镇务判断等玩法语境。镇务参谋或 AI 助手入口不能只是打开生成面板；应在主场景直接暴露下一步玩家动作、收益预览、记忆/上下文来源或不可行动原因，让 AI 能力体现为玩法判断。

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
| 系统运行时目录 | 主系统生成的安装/版本标记放 `storage/data`，数据库备份放 `storage/backups`；不要在仓库根目录生成 `data/` 或 `backups/`。 |
| 运行时文件 | 插件写入运行时生成文件时优先复用主系统 `FileStorageService.saveBuffer()` 并传入 `extensionId`，保留插件相对路径和公开 URL；不要在业务 service 里重复手写 `mkdir` / `writeFile` 根目录探测。 |
| 大内容 | 历史记录存 URL、file ID 或相对路径，避免把大文件或 base64 放进数据库。 |
| 删除保护 | `PENDING`、`PROCESSING`、导出中、审查中等状态默认禁止删除。 |

允许保留清晰的供应商协议适配层，例如 `responses`、`images`、`openai-compatible-images` 或视频异步网关协议；这类协议分层不是旧业务兼容层。

## 上传与 URL 安全

- 用户上传进入插件业务时，优先使用平台 `/upload/file` 或共享 `uploadFile()` 返回的 `fileId`。
- 插件后端读取或保存上传文件时导入主系统 `UploadModule`，注入 `FileUploadService` / `FileStorageService`；不要在插件模块重复注册平台 `File` / `StorageConfig`，也不要为了校验文件归属直接注入平台 `File` 仓储。
- 后端校验上传者、插件归属、大小、MIME/扩展名和 URL 格式后再处理文件。
- 文件解析、导出、AI 生成等异步流程写回业务记录前重新读取记录并检查 `deletedAt`。
- SSRF 防护默认拒绝任意外部 URL 指向本机或内网。
- 管理员配置的第三方 Base URL 属于外部 URL，保存时和运行时都必须校验协议、凭据、本机/内网和 DNS 解析结果。
- 已通过平台 `fileId`、上传者、插件归属、大小和 MIME 校验的插件上传文件，可以按本插件 `/uploads/` 路径允许本地或私有化部署域名。
- Provider 返回结果 URL 不允许指向本机、内网、带凭据或非 http/https 协议；写入业务记录或下载远程资源前必须使用主系统 helper 做 DNS 公网校验，需要下载时使用 `resolvePublicHttpUrl()` 的解析结果绑定请求地址，避免插件重复手写 DNS/IP 私网判断。
- `.gitignore` 保持忽略运行时 `storage/*`，但允许 `storage/static` 与必要 `.gitkeep` 入库。

## 游戏化与记忆

> 本节规则仅适用于经营/游戏化/叙事互动类插件（如 echoflow-ai-town），普通生成类、工具类插件不要求遵守。

### 首屏与降级

- 游戏化或经营类插件的资源变化必须可审计：事件 result 或业务记录保留 before/after、delta、规则来源或明细，用户端展示玩家可读解释，Console 可排查异常收益。
- 用户端存在日常行动循环时，服务端加每日行动预算、同日重复动作拦截和休息重置；前端展示剩余次数和拦截原因。
- 回访、连续登录或留存钩子若承诺奖励，奖励必须由服务端按钩子条件结算，进入 result/audit/resourceBreakdown；前端只展示预览、玩家可读结算说明和匹配钩子条件的可执行入口。回访奖励 CTA 也必须显示实际玩家动作，例如经营餐馆、拜访居民、探索街区或休息结算，不要用“领取奖励”“领取回访奖励”等福利式泛称替代实际行动。
- 经营游戏首屏在 Web API 或旧存档列表暂不可用时仍应展示可玩的场景预览、HUD、核心入口和玩家可读服务状态；服务异常说明也应使用开张、回到旧档、恢复小镇等玩家语境，不要写成创建、读取、加载、刷新等普通应用流程；不要因为后端未 ready 就白屏、长时间 loading 或只显示故障式错误。
- 经营游戏降级状态下，不可用的创建、生成或行动入口应转为等待态、重试命令或明确不可行动原因；不要保留看似可成功但必然触发网络失败的主按钮。
- 经营游戏首屏创建、恢复存档和重连服务的加载态也必须写成玩法对象，例如小镇开张中、正在翻看旧存档、重连镇务中；不要只写“创建中”“读取中”“连接中”这类普通应用状态。
- 经营游戏首屏的命令预览不能只是静态词条；应展示行动用途、收益预览、解锁或日结提示，并通过可访问名称保留完整说明。
- 经营游戏新手首屏必须给出一屏内可理解的第一分钟目标，例如三步开张路线、可得奖励或记忆影响；不要只展示品牌标题、氛围文案和开始按钮。经营游戏新存档主 CTA 应写成开张、启程、经营等玩家动作，例如“开张小镇”，不要写成“创建小镇”“新建存档”这类数据操作。
- 游戏化 UI 的奖励、推荐、热点、任务、抽屉和弹层动效必须支持 prefers-reduced-motion；减少动态效果时保留信息层级和视觉状态，但停止循环动画、弹跳、横向滑入或大幅位移。
- 自定义游戏抽屉或弹层必须具备 dialog 语义、标题关联、打开后自动聚焦、关闭后恢复触发点焦点、Tab 焦点循环、背景滚动锁定、Escape 关闭、可聚焦面板入口、带业务对象或面板标题的关闭按钮、遮罩点击关闭和内部点击防冒泡；不要只做视觉遮罩导致键盘或鼠标用户被困住，也不要把关闭按钮的可访问名称只写成“关闭”。
- 经营游戏首屏应优先用低遮挡回合状态条集中展示日期、行动预算、推荐动作和下一目标，再用游戏命令牌承接具体行动；中等宽度开始就应转为流式 HUD，避免与左右目标板、场景提示或命令牌争抢舞台。不要让玩家在多个边角面板里找当前回合重点。经营游戏首屏行动入口应呈现为游戏命令牌或等价 HUD，而不是普通按钮组；至少展示推荐、任务关联、收益预览、预算提示和不可行动原因，并避免遮挡主要场景。经营游戏首屏行动、推荐和预览的兜底文案也必须是玩家动作或玩法对象，例如打开委托册、可以出发、照看小镇或照看目标，不要退回“继续行动”“可执行”“查看任务”这类系统态。命令牌按钮的可访问名称必须合并动作名、推荐状态、任务关联、收益预览、预算提示和不可行动原因，避免移动端压缩或视觉标签隐藏后丢失玩法信息。
- 经营游戏首屏目标板中的活动、赛季或限时事件入口不能只写等待线索；无活动时也应给出探索街区、打开委托册或回到场景的玩家动作，有活动时展示状态、剩余时间和奖励摘要，并用可访问名称保留移动端压缩隐藏的活动目标。
- 移动端把 HUD、目标、命令或提示转为流式布局时，舞台容器必须允许纵向滚动并隐藏横向溢出，避免在主系统 iframe 或嵌入式 RootLayout 内裁切可操作内容。

### 行动与反馈

- 行动、生成或居民交流等待态必须显示具体玩家动作和业务对象，例如经营餐馆中、拜访居民中、镇务排班中或和某位居民交流中；不要只写“加载中”“处理中”或用无语境 spinner。
- 经营游戏用户端错误反馈必须使用玩法语境和可感知 alert 语义，例如说明小镇行动未完成、镇务服务暂未连接或某个玩家动作不可执行；不要回退到“操作失败”“请求失败”“请稍后再试”这类普通应用错误壳。
- 行动完成后的即时反馈必须像游戏奖励结算，展示事件标题、玩家可读总结和资源变化；不要只用普通 toast、裸数字条或表格行替代。
- 经营游戏的事件分支、剧情选择或行动选项应呈现为可执行分支牌，展示玩家动作、收益或风险预览、预算/资源拦截原因和明确不可行动状态；可访问名称必须合并分支名、执行状态、提示和预期变化，避免移动端压缩或视觉 chip 隐藏后只剩普通按钮。
- 经营游戏的日志或历史记录应优先呈现为故事册、时间线或章节回放，保留日期/阶段、事件类型、行动结果、分支选择和资源审计；不要只做后台式卡片网格、普通列表或脱离玩法的“记录中心”。
- 经营游戏的结算、日志、任务或成就空态必须给出下一步玩家动作、业务对象和可执行入口；不要只写“这里会显示”“暂无数据”或普通空列表。
- 奖励、结算、升级或任务完成反馈必须具备可感知状态语义，例如 `role="status"`、`aria-live="polite"` 和 `aria-atomic="true"`；不要只给视觉动画。
- 经营游戏地图或场景热点必须展示可行动性、推荐/升级/关系/记忆状态，并用可访问名称保留移动端压缩隐藏的关键说明；不得只做透明点击层、静态文字标签或无反馈装饰。
- 日常任务、主线章节、周目标、活动或赛季目标不能只展示进度条；用户端必须提供由规则层推导的下一步行动入口，并复用统一行动状态、资源、预算和建筑目标校验。行动按钮文案必须是玩家动作，例如经营餐馆、拜访居民、探索街区、升级建筑或休息结算，不要用“执行任务”“处理目标”“推进主线”“推进周目标”或“筹备活动”等后台式或目标式泛称。镇务参谋、今日计划或推荐行动入口也必须显示规则映射后的实际玩家动作，不要用“执行推荐行动”之类的系统命令文案。镇务参谋等待态应使用镇务排班中、整理今日计划等业务动作，不要写成思考中、生成中或分析中这类泛 AI 等待态。
- 旧存档、历史记录或继续入口也应使用回到小镇、回到存档、打开作品或继续创作等业务语境；不要只写“继续”“载入中”“打开”这类脱离玩法或业务对象的泛按钮。加载态文案同样要说明正在读取的对象，例如读取街区、恢复作品或打开记录。插件 lazy route、Suspense 和错误兜底属于首屏路径，加载、刷新、返回和未开放路径文案也要使用业务或玩法对象，例如读取街区、重读小镇、返回小镇或回到作品。经营游戏的删除、取消、确认等破坏性操作也应转换为业务对象和玩家动作，例如移入旧档箱、留在小镇、归档作品，并说明会影响的存档、角色、事件或作品范围。
- 商业化尚未接入正式计费时，用户端可以展示玩法价值预览，例如故事深度、记忆容量、角色章节、季节活动、外观表达、失败退款策略或未来权益边界，但必须明确当前不是购买入口，不得伪装成已开通订阅、已扣费权益或已完成失败退款闭环。经营游戏优先把商业价值做成成长册、内容包预告、章节路线或外观目标，不做数值碾压式售卖。
- 成长册、内容包预告或章节路线若展示未来商业价值，必须优先给出玩法行动入口并复用行动状态、行动预算和不可行动原因；正式计费接入前不得把 CTA 做成购买、开通会员或充值按钮。
- 经营游戏或即时互动类 AI 插件接入计费时，默认价格可以为 0 并保留免费玩法；真实模型成功且未 fallback 时才扣费，账务 `associationNo` 应使用本次行动、聊天、事件或任务的业务记录 ID，不使用存档 ID 这类会被多次复用的容器 ID。用户端展示扣费/退款事实应落在行动结果、居民回复或事件结算里，使用镇务额度、居民聊天额度、探索导演额度等业务语境兜底，不能暴露模型、Provider、Secret、管理员价格明细或“小镇 AI”等泛 AI 标签；成长册、章节路线和内容包预告即使已有 AI 行动计费，也不能自动变成购买、会员或充值入口。

### 对话与记忆

- 居民或 NPC 对话不能退化成普通表单；当存在记忆、偏好、约定或关键时刻时，用户端应提供可点选话题、角色回复气泡和清晰的额度/生成提示，让记忆成为可操作玩法。对话输入区必须说明正在给谁写话题，并提供居民化 placeholder、输入 aria-label 和聊天按钮可访问名称；对话提交按钮的可见文本也必须带当前对象或等待对象，例如“和小满聊天”“等小满回应”，不要只写“和居民聊天”“交流中”。
- 居民、角色、伙伴、参谋或关键 NPC 图片加载失败时，fallback 必须继续使用业务角色样式、尺寸和语境，覆盖列表、地图热点、HUD、确认卡和策略面板等首屏路径；不要退回通用应用头像、裸首字母圆点、裸文字或脱离题材的占位壳。
- 切换居民或 NPC 时必须清空上一位角色的输入和回复；生成或聊天成功后要用返回数据同步当前角色对象，避免旧气泡、旧关系或旧记忆显示到另一位角色上。
- 角色/NPC 记忆分层保存长期摘要、偏好、约定、关键时刻和有限最近消息；传给 LLM 时使用白名单摘要和短窗口。
- 当“记忆”是玩法卖点时，必须有确定性闭环影响后续行动、事件、关系收益、推荐目标、行动预览或 Console 判断。

### 内容与 Catalog

- 初始建筑、角色、行动、事件选项、日常任务、周目标、主线章节、成就、活动候选和留存钩子内容优先放在插件 catalog/seed/config 层；service 负责事务、校验和编排，规则服务负责计算。
- 内容包型、赛季型或经营叙事插件应提供 catalog manifest，记录内容包 ID、版本、赛季、包含的建筑/角色/任务/章节/活动范围、seed 策略和幂等键；存档或业务记录应保存内容包快照，旧数据读取或 Upgrade 时只做归一化，不把运营内容散落到 service 流程。
- 内容包型或经营游戏插件的测试要守住 catalog 边界：新增运营内容时断言 service/rule service 没有重新内联大段任务、章节、活动候选数组。

## 构建、发布与验证

发布前检查 `manifest.json` 与 `package.json` 版本一致且为合法 semver，发布版本不能低于当前版本。未上线插件不要因为本地修复反复增加版本号。

`pnpm extension:release` 只按白名单复制 `.output`、`build`、`src`、`storage/static`、`storage/.gitkeep`、`manifest.json`、`package.json`、`README.md`、`tsconfig*`、`tsup.config.ts`、`eslint.config.mjs`、`LICENSE` 等文件；不要依赖白名单外文件进入发布包。

发布包验证应以 CLI 白名单和真实安装目录为准，不要误把插件 `package.json.files` 当作 `extension:release` 的事实来源。若插件需要随包携带设计参考图、静态 catalog 或默认资源，应放入 `storage/static` 或白名单路径；运行时上传、生成结果、临时缓存和测试素材不得依赖发布包携带。

常用验证命令：

```bash
pnpm --filter <identifier> check-types
pnpm --filter <identifier> build:api
pnpm --filter <identifier> build:web
pnpm --filter <identifier> build:publish
pnpm --filter <identifier> test
```

插件 `package.json` 的 `test`、`build:publish` 等收口脚本必须直接串联实际工具命令，禁止嵌套 `pnpm run ...`，具体反例与正例参见"插件结构"章节的脚本命令约定。Windows/Corepack 环境下嵌套 pnpm 可能命中不同 pnpm shim 或项目 packageManager 版本检查，导致本地验证失败但业务代码无关。

涉及发布或安装时至少验证：版本识别、migration 执行、Upgrade 执行、旧数据保留、服务重启后页面可打开。本地浏览器验证优先用 `http://127.0.0.1:4090`。发布包本身不得携带 `node_modules`、`storage/uploads`、运行时生成结果或测试目录；升级安装验证的是主系统安装目录中的保留策略，例如当前主系统升级流程保留 `data` 与 `storage` 整目录，因此 `storage/node_modules`、上传缓存和插件运行时文件应在升级后仍存在。新装场景不能用“保留 storage/node_modules”作为验收项，应验证依赖安装、静态资产和页面路由是否可用。

代码收口阶段至少跑类型检查、API 构建、Web 构建和静态 diff 审查。真实外部模型调用、真实 Secret、Webhook 和失败退款属于正式联调阶段，未执行时不得描述为真实闭环已完成。

验证失败或环境阻塞必须写清楚具体命令、错误原因和后续条件；不能把缺少 optional native binding、Windows shell 缺 `sh`、服务未启动、浏览器未连通或测试替身缺依赖包装成已通过。

真实环境 smoke 脚本默认必须 fail-closed：需要登录态、Secret、余额、Redis/Worker 或会触发扣费/外部模型调用时，应显式要求 token 和生成开关，缺少条件时以清晰错误退出；默认路径只做不扣费的公开 API、页面或状态检查。

Windows PowerShell 下若 `pnpm --filter <identifier> build:*` 因 `sh is not recognized` 或 pnpm shell shim 失败，先在插件目录用底层 CLI 判断真实构建状态：API 用 `..\..\node_modules\.bin\tsup.cmd`，Web 用 `..\..\node_modules\.bin\vite.cmd build`；交付时必须区分 shell 环境阻塞与插件代码、Vite 配置或发布包失败。

若 `build:web` 失败在 Vite/Rolldown 配置加载或 HTML entry 解析阶段，先用最小 `index.html + main.js` smoke 复现，区分工具链/环境问题与插件业务代码问题。

插件单测若 mock `@buildingai/extension-sdk`、`@buildingai/core/modules` 或主系统 service，新增 SDK 导出后同步测试替身；测试替身不能缺少 `normalizeProviderConfig`、`resolveProviderSecretValue`、provider HTTP client、URL 校验和存储 helper 这类运行期会调用的公共函数。

插件单元/集成测试中，允许通过 jest `moduleNameMapper`、vitest alias 或等价测试配置把主系统 `@buildingai/*` 包映射到 monorepo 内源码路径（`<rootDir>/../../packages/<pkg>/src`），这仅限 `tests/**/*` 目录内的测试配置；运行时代码（`src/**/*`）禁止使用相对路径跨出插件目录引用主系统源码，必须通过 workspace 包名导入。jest、ts-jest 等测试运行器及其类型声明必须声明在插件本地 devDependencies，禁止通过 `node ../../packages/api/node_modules/jest/bin/jest.js` 这类路径依赖其他 workspace 包装的 CLI。

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

- Node.js：要求 `>=22.20.x <23`；本仓库使用 nvm 管理 Node，根目录 `.nvmrc` 固定为 `22.23.0`。
- Codex 桌面非交互 PowerShell 不保证自动切换 nvm 版本；若裸 `node -v` 命中全局 Node 24，不要误判为缺少 Node 22。先显式使用：`nvm use 22.23.0; node -v; corepack pnpm -v`。
- pnpm：项目声明 `pnpm@10.20.0`。
- Docker：本机实测 Docker `29.5.3`、Compose `v5.1.4`。
- Windows pnpm + Docker bind mount 会把 workspace 包内的 `node_modules` Junction 泄入 Linux 容器；凡 `nodejs` 服务会读取的 `packages/@buildingai/*/node_modules`，必须在 `docker-compose.yml` 用 anonymous volume 隔离，避免容器内解析到 `/mnt/host/...` 这类不可用宿主路径。
- 官方建议本地开发优先使用 pnpm：根目录安装依赖后运行 `pnpm dev:main`，插件目录可运行 `pnpm dev`、`pnpm dev:web`、`pnpm dev:api`。
- Docker 可用于基础依赖和完整环境验证：`docker compose up -d`，入口默认 `http://localhost:4090/install`。
- 手动路径：准备 PostgreSQL、Redis、主系统 `.env`，再运行 `pnpm install` 与 `pnpm start`。
- 插件业务配置不放 `.env`，走管理员后台配置或主站 Secret。

Windows 与沙箱常见故障排查：
- **sh is not recognized**：脚本里用了 Unix shell 语法（`&&` 没问题，但 `;`、`export`、`&&:` 等会失败）或嵌套调用了 pnpm 自身的 shell shim；收口脚本（build:publish、test）必须直接串联工具命令而非嵌套 `pnpm run`，参见"插件结构"章节的脚本约定。
- **pnpm install 报 `EACCES`/`disk I/O error`/`unable to open database file` 写 `D:\_tmp_<pid>_<rand>`**：这是 TRAE/Codex 沙箱把 `%TEMP%` 重定向到工作盘根目录但又未在白名单放行该路径所致，不是 pnpm 本身的问题。在 **Settings → Conversation → Custom Sandbox Configuration** 放行 `D:\_tmp_*` 即可；临时设置 `$env:TMP` 到工作区内不会绕过沙箱底层 API Hook。
- **pnpm install 报 `EEXIST: file already exists, junction` 或大量 `.ignored_*` 目录**：之前包管理器切换（npm/yarn → pnpm）或跨容器挂载遗留了失效 junction，执行 `pnpm store prune` 并手动删除 workspace 内 `.ignored_*` 前缀的空 junction 后重试。
- **pnpm 告警 `The "pnpm" field in package.json is no longer read by pnpm`**：根 package.json 还残留 `pnpm.*` 字段，按"工作区配置"章节要求迁移到 `pnpm-workspace.yaml`。
- **ERR_PNPM_CATALOG_NOT_FOUND**：插件引用了未在 pnpm-workspace.yaml catalogs 里定义的条目，在对应 catalog 分组补条目即可；不要绕过 catalog 写硬编码版本。
- **Corepack 版本冲突**：若全局 node 是 v24 而项目要求 v22，必须先 `nvm use 22.23.0`；否则 corepack 可能拉错 pnpm shim，出现 `Unsupported engine` 或脚本找不到命令。

## 品牌静态资源

- `logo.png` 是方形品牌图，用于 favicon、头像、折叠菜单和 `size-8` 等方形展示位。
- `logo-full.png` 是横版品牌图，用于工作台侧栏、登录页、AppLogo 等横向展示位。
- 默认 UI 不再使用 `logo.svg` 或 `logo-full.svg`；新增引用时按展示位选择 PNG。
- 静态品牌资源变更后至少运行 `pnpm --filter echoflowai-client build`。
- 发布态 `public/web/assets` 由构建或发布流程刷新，不手工修改压缩产物。

## 当前阶段看板

| 优先级 | 事项 | 完成条件 | 验证方式 |
|---|---|---|---|
| P1 | 真实端到端 smoke | 配好主站 Secret、测试用户、余额和存储，覆盖图像、视频、合同、星盘、小镇的成功、失败、退款或 fallback。 | `pnpm --filter <id> smoke:web`（需 token/开关）+ 浏览器 E2E 录屏 |
| P1 | 队列与恢复 smoke | 验证图像、合同、星盘和视频的 Redis/Worker 拓扑、抢占、重复执行保护、超时回收、重启恢复、软删除保护和失败补偿。 | 本地 docker compose 重启 Worker + 队列状态 API + focused tests |
| P2 | 主系统能力复用审查 | 清理直接 provider 注入、内存队列、进程内限流、手写密钥脱敏、手写文件 URL、手写通知/签名协议和可替换裸 UI 控件。 | 静态 diff + 边界测试（public types、manifest、SDK boundary） |
| P2 | 上传与 URL 安全审查 | 所有接收文件、URL、Webhook 回调和远程资源下载入口只接受平台上传或受信任 provider 返回值。 | SSRF/URL 边界测试 + `assertPublicHttpUrl` 覆盖率检查 |
| P2 | 异步终态一致性审查 | 图像、合同、星盘等异步链路具备二次读取、锁定、终态短路和软删除保护。 | 终态重复触发测试 + 删除保护测试 |
| P2 | 测试补强 | 为失败退款、计费幂等、队列入队失败、恢复扫描、文件归属、世界规则和 AI fallback 补 focused tests。 | `pnpm --filter <id> test` 全绿 + 新增测试覆盖新分支 |
| P3 | 发布前整理 | 清理或确认未跟踪文件、锁文件必要性、构建产物和提交分组。 | `git status` 审查 + `pnpm build && pnpm typecheck` 全绿 |

## 交付检查

- [ ] 明确业务目标、插件 identifier、可改文件、谨慎文件、数据/升级/存储方案和验证命令。
- [ ] 实现只落在插件或约定二开目录；主系统缺口必须能说明原因、影响、上游风险和验证方式。
- [ ] 验证至少覆盖插件构建、类型检查、后端 API 或前端页面 smoke；涉及发布时跑 `pnpm extension:release`，并检查 zip 内容与安装路径中的 `.output`、`build`、`manifest.json`、`README.md`、`storage/static` 和运行时目录保留策略。
- [ ] 交付时说明改动范围、验证结果和剩余阻塞；不得把"未配置 upstream"或"服务未 ready"包装成已完成。
- [ ] 若本轮产生或参考了 `docs/`、`.agents/`、`.codex/`、临时计划或审查草稿，交付前把仍有效的规范、验证结论和剩余风险合并到 `AGENTS.md` 或对应插件 `README.md`；临时文档不得作为长期事实源继续维护。
- [ ] `pnpm-workspace.yaml`、根 `package.json`、`pnpm-lock.yaml`、`turbo.json` 等谨慎文件的变更已在提交说明里写明原因。
- [ ] `templates/extension-starter/` 和 `extensions/simple-blog/` 仍符合本规范全部规则（如本轮修改了规范相关内容，同步检查模板和示例）。
