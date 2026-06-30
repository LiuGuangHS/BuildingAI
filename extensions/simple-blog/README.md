# Simple Blog

`simple-blog` 是 BuildingAI 官方示例博客插件，同时作为插件开发参考模板。提供文章分类、文章 CRUD、公开浏览和 Console 管理能力。

文档维护：跨插件通用规范见根 `AGENTS.md`；本 README 只记录本插件的业务事实、入口、特有边界、验证状态、风险和下一步。临时计划或 QA 结论收口后只合并仍有效内容，不长期维护第二套文档。

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

## 用户端边界

| 主题 | 说明 |
|---|---|
| Web | 文章列表、分类浏览、文章详情和分页浏览，默认 50 条/页。 |
| Console | 分类管理、文章增删改查和批量删除。 |

## 关键技术边界

| 能力 | 当前实现 |
|---|---|
| 业务模型 | Article、Category 作为官方示例实体，覆盖文章、分类、公开浏览和 Console CRUD。 |
| 数据一致性 | 文章创建/更新/删除/批量删除会联动分类计数；分类 `articleCount` 和文章 `viewCount` 都使用 SQL 原子操作。 |
| 默认数据 | 首次安装通过 seeders 创建默认分类，`0.0.2` upgrade 使用 NestJS Logger 输出。 |
| 模板价值 | 作为官方示例，应持续符合根 `AGENTS.md` 的插件结构、DTO、事务、UI 和验证规则。 |

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
| 事务安全 | 写操作事务边界已覆盖文章和分类计数联动。 |
| 原子计数 | 分类计数和浏览量均使用 SQL 原子操作。 |

## 作为参考模板

`simple-blog` 是官方示例插件，重点展示标准插件结构、Web/Console 双入口、插件实体、事务写入、原子计数和发布验证。通用开发规范以根 `AGENTS.md` 为准，不在本 README 重复维护。

