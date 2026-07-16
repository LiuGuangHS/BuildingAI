# BuildingAI API 开发规范

## 技术栈

NestJS + PostgreSQL + TypeORM + Redis，pnpm 包管理，PM2 进程管理。运行基线以根目录为准：Node.js `>=22.20.x <23`，pnpm `10.20.0`。

## 事实源

- 全仓规则：根 `AGENTS.md`。
- 运行入口：`packages/api/src/main.ts`。
- 动态模块：`packages/api/src/modules/app.module.ts`。
- 包脚本：`packages/api/package.json`。
- 环境变量：根 `.env.example`。

本文件只记录 API 包约定，不覆盖全仓库规范。

## 项目结构

### 包结构

- `packages/@buildingai/` - 公共包（base、cache、config、constants、core、db、decorators、dto、errors、extension-sdk、logger、pipe、utils 等）
- `packages/api/` - 主 NestJS API 应用
- `extensions/*/src/api/` - 插件后端模块，由主系统动态加载构建产物

### API 包结构

- `src/common/` - constants、decorators、filters、guards、interceptors、interfaces、modules、utils
- `src/core/` - database、logger、queue、extension upgrade 等核心运行能力
- `src/modules/` - 主系统业务模块

### 业务模块结构

```text
src/modules/{module-name}/
├── {module-name}.module.ts
├── controllers/
│   ├── web/{name}.controller.ts
│   └── console/{name}.controller.ts
├── services/{name}.service.ts
├── dto/{action}-{name}.dto.ts
└── interfaces/、handlers/、utils/    # 可选
```

### 路径别名

- `@common/*` → `src/common/*`
- `@modules/*` → `src/modules/*`
- `@core/*` → `src/core/*`
- `@assets/*` → `src/assets/*`

## 控制器规范

- 后台：`@ConsoleController(path, groupName)`，路由前缀 `/consoleapi/`，自动启用认证和权限。
- 前台：`@WebController(path)`，路由前缀 `/api/`，默认需认证，`skipAuth: true` 可跳过。
- 权限：`@Permissions({ code, name, description? })` 标记接口权限。
- 当前全局 `ValidationPipe` 使用 `whitelist: true` 和 `forbidNonWhitelisted: true`；DTO 必须装饰所有允许字段，未知字段会被拒绝，不是静默忽略。

## 服务与实体规范

- 通用 CRUD 优先继承 `BaseService<Entity>`。
- 主系统实体统一从 `@buildingai/db/entities` 导入。
- 插件业务实体应使用 `@ExtensionEntity()` 并落入插件独立 schema。

## 守卫执行顺序

DemoGuard → AuthGuard → ExtensionGuard → PermissionsGuard → SuperAdminGuard

跳过认证：`skipAuth: true`；跳过权限：`skipPermissionCheck: true`。

## 常用装饰器

- `@Playground()` - 获取当前登录用户。
- `@BuildFileUrl(["**.avatar"])` - 自动构建文件 URL。
- `@UUIDValidationPipe` - UUID 参数验证。

## 错误处理

使用 Nest HTTP 异常或 `HttpErrorFactory`：`notFound()`、`paramError()`、`unauthorized()`、`business(msg, code)`。Controller 不要捕获业务异常后返回 200。

## AI 流式接口

- Chat、Agent、Dataset 在创建新会话记录前完成模型、Provider 和 Secret 可用性检查。
- 请求生命周期只在客户端真正中止或响应关闭时触发 Abort；不要把普通 POST body 读取完成当作流中止。
- 上游 `401/403/429/5xx`、流转换错误和主动中止必须保留失败语义并透传可显示的错误，不能只写日志后正常结束 SSE。
- 仅在未中止、无流错误且存在有效生成结果/usage 时扣费和执行标题、追问建议等后处理。失败请求不得因为估算 usage 或空 assistant 记录而扣费。
- 日志可以记录最终 Provider endpoint、模型、HTTP 状态码和脱敏错误代码，但不得记录完整 API Key、Authorization header 或 Secret payload。
- 真实模型 smoke 会访问外部服务并可能产生费用；执行前确认所用 Secret、模型、余额和明确的生成授权。

## 导入顺序

`@buildingai/*` → `@nestjs/*` → `@common/*` → `@modules/*` → `@core/*` → 第三方包 → 相对路径。

## 命名规范

- 文件：`{name}.controller.ts`、`{name}.service.ts`、`{action}-{name}.dto.ts`、`{name}.module.ts`
- 类：`{Name}Controller`、`{Name}{Type}Controller`、`{Name}Service`、`{Action}{Name}Dto`、`{Name}Module`

## 验证

API 改动优先使用最小验证：

```bash
pnpm --filter @buildingai/api check-types
pnpm --filter @buildingai/api lint
```

行为或测试改动再运行相关 `test`。不要默认执行 install、format fix、Docker/PM2 生命周期或数据库写操作。
