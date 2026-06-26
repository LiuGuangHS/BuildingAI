# Simple Blog

`simple-blog` 是 BuildingAI 官方示例博客插件，同时作为插件开发参考模板。提供文章分类、文章 CRUD、公开浏览和 Console 管理能力。

文档维护规则：全仓公共边界、主系统二开、上游同步、组件化 UI 和验证规则维护在根目录 `AGENTS.md`；本 README 只维护 `simple-blog` 作为官方示例的业务边界、能力状态、入口、数据/事务/安全事实和验证命令。临时分析和计划文档只作为施工材料，有效结论合并回 `AGENTS.md` 或本 README。

## 定位

| 维度 | 当前边界 |
|---|---|
| 产品形态 | 官方示例 + 轻量博客 CMS，展示插件标准结构。 |
| 用户端 | 文章列表、分类浏览、文章详情、分页浏览（默认 50 条/页）。 |
| Console | 分类管理、文章增删改查、批量删除。 |
| 数据安全 | 分类计数和浏览量使用 SQL 原子操作；CRUD 操作使用事务包裹。 |

## 当前能力

| 能力 | 状态 | 说明 |
|---|---|---|
| 分类 CRUD | ready | 分类创建/更新/删除，文章计数原子增减。 |
| 文章 CRUD | ready | 文章创建/更新/删除/发布，事务包裹分类计数联动。 |
| 批量删除 | ready | 批量删除文章时使用 CASE WHEN 单 SQL 批量更新分类计数。 |
| 浏览量 | ready | 使用 `increment` 原子操作，避免 read-modify-write 竞态。 |
| 分页 | ready | 公开文章列表默认 `take: 50` 限制，防止全表扫描。 |
| DTO 验证 | ready | title/content/summary/cover 均有长度/格式校验；cover 使用 `@IsUrl` HTTP/HTTPS 校验；content 限制 100000 字符。 |
| 错误处理 | ready | Controller 层异常冒泡到全局过滤器，不再 try/catch 吞异常返回 200。 |
| Service/Controller 继承 | ready | ArticleService 继承 BaseService，使用 withTransaction 等通用能力。 |
| Upgrade 日志 | ready | 0.0.2 upgrade 使用 NestJS Logger 而非 console.log。 |

## 入口与页面

| 入口 | 路径 | 文件 | 职责 |
|---|---|---|---|
| Web | `/extension/simple-blog/` | `src/web/pages/index.tsx` | 博客首页、文章列表、分类筛选。 |
| Web | `/extension/simple-blog/article/:id` | `src/web/pages/article/[id].tsx` | 文章详情页。 |
| Console | `/console/column` | `src/web/pages/console/column/list.tsx` | 分类管理列表/编辑。 |
| Console | `/console/article` | `src/web/pages/console/article/list.tsx` | 文章管理列表/新增/编辑。 |

路由由 `src/web/routes.tsx` 注册；前端通过 `consoleHttpClient` 和 `apiHttpClient` 分别调用 Console/Web API。

## API 与后端模块

| Controller | 装饰器路径 | 说明 |
|---|---|---|
| Web article | `@ExtensionWebController("article")` | 公开文章列表、详情、浏览量。 |
| Web category | `@ExtensionWebController("category")` | 公开分类列表。 |
| Console article | `@ExtensionConsoleController("article", "文章管理")` | 文章 CRUD、批量删除。 |
| Console category | `@ExtensionConsoleController("category", "分类管理")` | 分类 CRUD。 |

关键服务：

| 服务 | 说明 |
|---|---|
| `ArticleService extends BaseService<Article>` | 文章 CRUD、事务包裹、原子浏览量、批量删除。 |
| `CategoryService` | 分类 CRUD、原子计数增减。 |

## 主系统复用边界

| 能力 | 当前实现 |
|---|---|
| BaseService | ArticleService、CategoryService 均继承 `@buildingai/base` 的 BaseService，复用通用 CRUD 和 `withTransaction`。 |
| 事务 | 文章创建/更新/删除/批量删除均使用 `withTransaction` 包裹，事务开头执行 `SET LOCAL lock_timeout = 3000`，通过文件级常量 `LOCK_TIMEOUT` 统一管理。 |
| DTO 验证 | 使用 class-validator：`@IsUrl` 校验 cover URL 协议（http/https），`@MaxLength(100000)` 限制 content 长度，`@MaxLength(200)` 限制 title。 |
| 错误处理 | Service 层使用 `HttpErrorFactory.badRequest/notFound` 抛出 HTTP 异常，Controller 层不使用 try/catch 吞异常，异常冒泡到全局过滤器。 |
| 种子数据 | 首次安装通过 seeders 创建默认分类。 |
| UI | 复用主系统 Button、Card、Input、Textarea、Select、Badge、Label 等组件。 |
| i18n | 使用 `@buildingai/i18n` 多语言支持。 |

## 数据与存储

| 数据 | 说明 |
|---|---|
| 实体 | Article、Category 使用 `@ExtensionEntity()`。 |
| Migration | 首版 migration：`src/api/db/migrations/1781539200004-0.0.1-init-simple-blog.ts`。 |
| Upgrade | `src/api/upgrade/0.0.1/index.ts` 初始化 extension 安装记录；`0.0.2/index.ts` 使用 logger 输出。 |
| 原子操作 | 分类 `articleCount` 使用 SQL `GREATEST(articleCount ± N, 0)`；文章 `viewCount` 使用 TypeORM `increment()`。 |
| 批量操作 | 批量删除使用 `CASE WHEN` 单 SQL 批量减计数，避免 N+1 查询。 |

## 开发与验证

```bash
pnpm --filter simple-blog check-types
pnpm --filter simple-blog build:api
pnpm --filter simple-blog build:web
pnpm --filter simple-blog build:publish
```

| 项目 | 状态 |
|---|---|
| `check-types` | pass |
| `build:api` | pass |
| `build:web` | pass |
| 事务安全 | 所有写操作包裹在事务内并设置 lock_timeout。 |
| 原子计数 | 分类计数和浏览量均使用 SQL 原子操作。 |

## 作为参考模板

`simple-blog` 作为官方示例插件，新插件应参考以下规范实现：

1. **Service 继承 BaseService**：复用分页、事务包装、通用 CRUD。
2. **Controller 继承 BaseController**：统一错误处理。
3. **DTO 完整验证**：每个字段都有 class-validator 装饰器，URL 字段用 `@IsUrl`，文本字段加 `@MaxLength`。
4. **事务包裹**：涉及多表写操作使用 `withTransaction`，事务内设置 lock_timeout。
5. **原子计数**：避免 read-modify-write 竞态。
6. **错误处理**：Controller 层不吞异常，Service 层抛 HTTP 异常而非 `new Error()`。
7. **批量操作**：避免循环内逐条 SQL。
