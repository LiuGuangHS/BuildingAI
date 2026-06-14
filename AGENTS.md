# EchoFlow插件开发规范

本仓库按 BuildingAI 官方二开与插件体系协作。所有 Agent 和人工改动都以本文件为准：新增能力放插件或独立二开文件夹，主系统作为只读基座。

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

## 硬边界

- 新增业务功能只能放在 `extensions/<identifier>/` 或经用户确认的独立二开文件夹。
- 默认可改：`extensions/<identifier>/`、`skills/`、`templates/`、`docs/`、`.agents/`、`.codex/`、根目录协作文档。
- 默认只读：`packages/`、`public/web/`、`scripts/`、`docker-compose.yml`、`turbo.json`、`pnpm-workspace.yaml`、根 `package.json`、锁文件和主系统构建产物。
- 禁止通过 patch 主系统绕过插件能力。若官方扩展点不够，先写缺口、影响和可选方案，等用户明确授权。
- 插件调用主系统能力必须走官方公开 SDK、装饰器、CLI、扩展注册、前端路由和 HTTP 客户端。
- 需要修改主系统只读区时，先说明：缺口来源、为什么插件能力不足、会改哪些文件、上游升级风险和回滚方式；得到用户本次明确授权后再动。

## 插件规范

- 优先用官方 CLI 创建：`pnpm extension:create`；也可用等价仓库脚本 `pnpm buildingai extension:create`。
- 插件目录必须是 `extensions/<identifier>/`；`identifier` 使用小写字母、数字和连字符，并与目录名、`manifest.json`、前端 route base、后端路径前缀保持一致。
- 本仓库二开业务插件统一使用 `echoflow-*` 前缀；每个新插件仍按独立业务目标选择自己的 `<identifier>`，不要复用现有插件目录承载无关能力。`simple-blog`、`extension-starter` 等官方示例/模板不作为业务插件命名参考。
- `manifest.json` 描述 `identifier`、`name`、`type`、`version`、`description`、`author`、`engine.buildingai`；`package.json` 管构建脚本、导出入口、依赖和版本。
- `manifest.json.identifier`、`package.json.name`、目录名、`defineRouteOption({ base, identifier })`、`defineExtensionViteConfig(packageJson)` 必须同名；当前模板会用 `packageJson.name` 生成 `/extension/<name>` 前端 base。
- 本地插件需要登记到 `extensions/extensions.json` 才能被本地环境发现；官方 CLI 会自动处理，手工创建或复制插件时必须同步登记。
- 后端入口使用 `src/api/index.ts` 导出插件 `AppModule`，模块按 `src/api/modules/{module}/controllers/{console,web}`、`services`、`dto` 组织。
- 插件实体使用 `@ExtensionEntity()`，让表落到插件独立 schema；不要直接用普通 `@Entity()` 写插件表。
- 后端接口使用 `@ExtensionConsoleController()` 和 `@ExtensionWebController()`；默认路径分别挂到 `/{identifier}/consoleapi/*` 与 `/{identifier}/api/*`，实际以前后端 `VITE_APP_*_API_PREFIX` 配置为准。
- 插件 Controller/Entity 装饰器从 `@buildingai/core/decorators` 导入；通用装饰器如 `Public`、`Playground`、`BuildFileUrl`、`SkipTransform` 再从 `@buildingai/decorators` 导入。
- 后端依赖优先使用 `@buildingai/extension-sdk`、`@buildingai/base`、`@buildingai/core/decorators`、`@buildingai/decorators`、`@buildingai/db`、`@buildingai/dto`、`@buildingai/pipe`、`@buildingai/errors`、`@buildingai/utils` 等公开包。
- 前端入口放 `src/web/main.tsx`，路由优先用 `@buildingai/web-core` 的 `defineRouteOption()`，HTTP 优先用 `@buildingai/services` 的 `createPluginHttpClients()`。
- 前端依赖优先使用 `@buildingai/ui`、`@buildingai/http`、`@buildingai/services`、`@buildingai/services/shared`、`@buildingai/stores`、`@buildingai/hooks`、`@buildingai/web-core`，插件 service 建议分 `src/web/services/{console,web,types}`。
- 数据、初始化和升级闭环在插件内：实体、迁移放 `src/api/db`；种子放 `src/api/db/seeds` 并导出 `getSeeders()`；升级脚本放 `src/api/upgrade/<version>/index.ts`；上传与静态存储放 `extensions/<identifier>/storage`。
- 发布必须走官方 `extension:release` 流程，只依赖发布白名单文件；发布前至少跑插件构建、类型检查和必要 smoke test。
- EchoFlow 业务插件文档统一维护在插件 `README.md`；种子数据、质量门禁、路线图和后续待办都写入 README，不再新增独立规划、质量或 Seeds 文档。

## 计费与 AI 能力

- 插件需要扣减或返还用户积分时，优先注册 `ExtensionBillingModule` 并使用 `ExtensionBillingService`；若沿用本仓库现有直接 provider 写法，必须同时把 `User`、`AccountLog` 纳入 `TypeOrmModule.forFeature()` 并导入必要依赖。禁止直接改用户余额或账单表。
- 计费流程要能解释清楚：估算金额、余额预检、扣费时机、失败退款、账务状态字段、幂等/重复请求处理。
- AI 生成、文件解析、第三方任务等长流程默认采用“余额预检 -> 业务记录入库 -> 预扣 -> 成功写结果或失败退款”。如果改用成功后扣费，必须在 README 和后台文案里说明差异。
- 扣费要以业务记录 ID 作为 `associationNo`，并检查同一 `associationNo` 是否已有 `ACCOUNT_LOG_TYPE.PLUGIN_DEC` + `ACTION.DEC` 账务记录，避免重复扣费。
- 长任务或第三方调用建议先建业务记录并记录 `billingStatus`、`billingAmount`、外部任务 ID；失败分支必须记录原因并按策略退款。退款失败要写入业务记录元数据，例如 `providerMetadata.refundError`。
- 事务内扣费/退款时，把同一个 `EntityManager` 传给 `deductUserPower()` 或 `addUserPower()`，避免业务记录和账务不一致。
- 插件接入平台模型时，优先注册 `AiPublicModule` 并用 `PublicAiModelService` 获取模型、供应商配置和 provider adapter；若直接 provider 注入，必须补齐 `AiModel`、`AiProvider`、`Secret`、`SecretTemplate`、`SecretService` 等依赖。只有做底层 AI 工作流封装时才直接使用 `@buildingai/ai-sdk`。
- 插件的模型配置页只列 `isActive: true` 且 `modelType: "llm"` 的模型，并过滤未启用的 Provider；保存默认模型时也要重新校验模型和 Provider 状态。
- Console 模型列表返回值要与前端类型一致。若前端需要显示供应商，优先返回 `providerName`，需要对象字段时返回 `{ id, name, provider, isActive }`，不要把 `provider` 一会儿当字符串、一会儿当对象。
- 插件自己的第三方 API Key 和服务参数必须走管理员后台 Console 配置、数据库配置或平台密钥配置，不使用环境变量作为插件配置入口。
- 不要把真实密钥写入源码、`manifest.json`、前端包或 `.env`；交付时说明管理员后台需要配置哪些字段、默认值和验证方式。

## Seeds、Migration、Upgrade 与存储

- Seeds 只负责首次安装初始化数据，必须可重复执行且通过 `shouldRun()` 或唯一键避免重复；升级时不要依赖 seeds 修复旧数据。
- 如需记录种子数据说明，写入插件 README 的“种子数据”章节；除官方示例或历史遗留外，不新增独立 `SEEDS.md`。
- 表结构变化写插件 migration：`extensions/<identifier>/src/api/db/migrations/`；升级前先构建 API，使生成命令能读取最新实体。
- 数据修复、默认值回填、跨表搬迁、历史数据兼容写 Upgrade：`src/api/upgrade/<version>/index.ts`；Upgrade 要和插件版本绑定、尽量幂等、失败可定位。
- 不要把表结构修改塞进 Upgrade，也不要把一次性历史修复写进正常 service 运行逻辑。
- 写完 migration 或 Upgrade 后必须提升 `package.json.version` 与 `manifest.json.version`，并运行 `pnpm --filter <identifier> build:api` 或 `pnpm --filter <identifier> build:publish`，确认产物进入 `build/db/migrations` 或 `build/upgrade/<version>`。
- 插件运行时上传/生成文件放 `storage/uploads` 等运行目录；需要随发布包携带的静态文件放 `storage/static`。历史记录存 URL、文件 ID 或相对路径，避免把大文件或 base64 放进数据库。
- 用户上传文件进入插件业务时，优先使用平台 `/upload/file` 或共享 `uploadFile()` 返回的 `fileId` 作为业务入参；后端用 `File` 表校验上传者、插件归属、大小、MIME/扩展名和 URL 格式后再处理。不要让用户端直接提交任意外部 URL 给后端解析、下载或转存。
- 文件解析、导出、AI 生成等异步流程写回业务记录前要重新读取记录并检查 `deletedAt`；处理中、导出中、审查中等状态默认禁止用户或管理员删除，避免软删除后后台任务继续写入或创建孤儿版本。
- `.gitignore` 保持忽略运行时 `storage/*`，但允许 `storage/static` 与必要 `.gitkeep` 入库。

## 发布与升级检查

- 发布前检查 `manifest.json` 与 `package.json` 版本一致且为合法 semver；发布版本不能低于当前版本。
- `pnpm extension:release` 会按白名单复制 `.output`、`build`、`src`、`storage/static`、`storage/.gitkeep`、`manifest.json`、`package.json`、`README.md`、`tsconfig*`、`tsup.config.ts`、`eslint.config.mjs`、`LICENSE` 等文件；旧模板/示例若仍有 `SEEDS.md` 也可能进入发布包，但 EchoFlow 业务插件不依赖独立 `SEEDS.md`。不要依赖白名单外文件进入发布包。
- 发布包生成前默认选择 rebuild；如跳过 rebuild，必须说明使用的是哪一次构建产物。
- 升级联调至少验证：版本识别、migration 执行、Upgrade 执行、旧数据保留、storage/node_modules 保留、服务重启后页面可打开。
- 插件更新文档当前仍标注待完善，遇到升级策略分歧时，以 `插件升级开发文档`、CLI 实现和项目实际行为为准，并在交付中写明假设。

## 双前端与双 Service 层

BuildingAI 插件有 **两个前端入口** 和 **两个后端 API 通道**，必须按角色严格分离：

### 前端双入口

| | Web 用户端 | Console 管理端 |
|---|---|---|
| **页面目录** | `pages/index.tsx` 等 | `pages/console/*.tsx` |
| **路由配置** | `defineRouteOption({ routes: [...] })` | `defineRouteOption({ consoleRoutes: [...], consoleMenus: [...] })` |
| **访问路径** | `/extension/{id}/` | `/extension/{id}/console/` |
| **职责** | 面向最终用户的核心功能页 | 面向管理员的后台管理 |
| **设计原则** | **直接展示功能**，不要做成落地页/CTA 中间页 | 管理面板：列表、CRUD、批量操作 |

参考模板 starter：
- `pages/index.tsx` 直接展示博客文章列表（功能页）
- `pages/console/article/list.tsx` 是后台文章管理

### 后端双 Controller + 双 HTTP Client

| | Web API | Console API |
|---|---|---|
| **装饰器** | `@ExtensionWebController("path")` | `@ExtensionConsoleController("path", "Group")` |
| **挂载路径** | `/{identifier}/api/{path}/*` | `/{identifier}/consoleapi/{path}/*` |
| **调用方** | `apiHttpClient` | `consoleHttpClient` |
| **Service 目录** | `services/web/` | `services/console/` |
| **典型端点** | 用户生成内容、查看自己的数据 | 管理员 CRUD、批量操作 |

`createPluginHttpClients()` 同时返回两者：
```ts
import { createPluginHttpClients } from "@buildingai/services";
const { apiHttpClient, consoleHttpClient } = createPluginHttpClients();
```
- Web 页面 hooks 用 `apiHttpClient`，访问 Web Controller
- Console 页面 hooks 用 `consoleHttpClient`，访问 Console Controller
- 两类 hooks 分别放在 `services/web/` 和 `services/console/`
- 实际前缀由 `.env` 的 `VITE_APP_WEB_API_PREFIX`、`VITE_APP_CONSOLE_API_PREFIX` 与后端装饰器共同决定；当前项目配置为 `/api` 与 `/consoleapi`。

### 常见错误

- ❌ 全部端点写在一个 Controller 里，只注册 Console Controller
- ❌ Web 首页做成营销落地页 + "进入工作台"按钮（应直接展示功能）
- ❌ Web 页面用 `consoleHttpClient` 调 Console API（认证/权限不同）
- ❌ 只用 `consoleHttpClient`，忽略 `apiHttpClient`
- ❌ Console 页面把管理员接口返回的 `provider` 字段误当另一种结构展示，导致模型供应商显示错误
- ❌ 用户上传审查、解析或导入功能绕过平台上传记录，直接接收可访问 URL

## Git 与上游

- 开发前固定检查：`git status --short --branch`、`git remote -v`、`git fetch origin`；只有确认已配置 `upstream` 后才执行 `git fetch upstream`。
- 当前本地分支以 `git status --short --branch` 为准；2026-06-13 实测为 `master...origin/master`。
- 2026-06-13 状态快照：当前仅配置 `origin=https://github.com/LiuGuangHS/BuildingAI`，未配置 `upstream`；在配置官方上游前，不得声称已对齐官方上游。
- 建议官方只读上游：`upstream=https://github.com/BidingCC/BuildingAI.git`。只允许 fetch，不允许 push。
- 禁止向官方上游提交、推送或开 PR，除非用户单次明确要求。禁止 `git push upstream`、`git push --mirror`、`git push --all`。
- 需要推送时必须先确认目标远端和分支；二开仓库的 `origin` 不等同于官方上游。

## 环境基线

- Node.js：要求 `>=22.20.x <23`，本机实测 `v22.20.0`。
- pnpm：项目声明 `pnpm@10.20.0`，本机实测 `10.20.0`。
- Docker：本机实测 Docker `29.5.3`、Compose `v5.1.4`。
- 官方建议本地开发优先使用 pnpm：根目录安装依赖后运行 `pnpm dev:main`，插件目录可运行 `pnpm dev`、`pnpm dev:web`、`pnpm dev:api`。
- Docker 可用于基础依赖和完整环境验证：`docker compose up -d`，入口默认 `http://localhost:4090/install`。
- 手动路径：准备 PostgreSQL、Redis、主系统 `.env`，再运行 `pnpm install` 与 `pnpm start`；插件业务配置不放 `.env`，走管理员后台配置。
- 2026-06-13 Docker 实践快照：`postgres`、`redis` 已 healthy；`buildingai-nodejs` 已绑定 `4090`，首次 `pnpm i` 下载依赖期间可能短时 unhealthy，`/install` 需待依赖完成后复查。
- 运行联网、拉镜像、写 Docker 数据或安装依赖前，要说明目的和影响。

## 交付流程

1. 先读官方二开/插件文档、`templates/extension-starter/`、现有 `extensions/simple-blog/` 和相关 SDK 参考。
2. 写计划时明确：业务目标、插件 `identifier`、可改文件、只读文件、数据/升级/存储方案、验证命令。
3. 实现只落在插件或约定二开目录；主系统缺口必须先记录并等待授权。
4. 验证至少覆盖插件构建、类型检查、后端 API 或前端页面 smoke test；涉及发布时跑 `extension:release`。
5. 交付时说明改动范围、验证结果、剩余阻塞。不得把“未配置 upstream”或“服务未完全 ready”包装成已完成。

## 状态快照与待办

以下为 2026-06-14 本地状态，执行前需重新核对：

1. 等用户确认后添加只读 `upstream` 并 fetch，核对官方分支。
2. 优先按官方建议使用本地 pnpm 运行与联调；Docker 作为完整环境/依赖验证路径。
3. 当前本地已有插件示例/项目包括 `extensions/simple-blog/`、`extensions/echoflow-video/`、`extensions/echoflow-image/`，并已登记到 `extensions/extensions.json`；后续可继续按 `echoflow-*` 新增其他业务插件。
4. 已有 `extensions/echoflow-video/`（HappyHorse AI 视频生成）与 `extensions/echoflow-image/`（OpenAI-compatible 图片生成）待本地 pnpm 服务或 Docker 完整环境就绪后联调测试。
5. 对任意涉及第三方服务的新插件，都应在管理员后台提供供应商参数、API Key、连通性/健康检查等配置闭环。
