# 主系统运行故障排查

当 API 已成功启动，但主系统功能不可用、无响应或行为不一致时使用本手册。仓库规则和安全边界仍以 `AGENTS.md` 为准。

## 诊断顺序

1. 确认故障时间、操作流程、所选模型/Provider，以及余额或计费是否变化。
2. 读取对应时间附近的持久化日志；以下命令读取当天日志，排查历史问题时替换日期路径：

   ```bash
   tail -n 300 logs/$(date +%Y-%m)/$(date +%d).log
   tail -n 300 logs/pm2/api-error.log
   tail -n 300 logs/pm2/api-out.log
   ```

3. 记录最终上游 endpoint、HTTP 状态码、错误类型和脱敏后的响应代码。不得输出 API Key、Authorization header、Cookie、JWT 或原始 Secret payload。
4. 修改代码前先分类：
   - `401/403`：Secret、凭据权限或上游认证问题。
   - `404/405`：Base URL 或协议模式不匹配。
   - `429`：额度或限流。
   - `5xx`/超时：上游可用性、代理、DNS 或网络路径。
   - 没有发起上游请求：本地校验、路由、Abort 或流初始化。
   - 上游成功但 UI 没有结果：SSE 转换、持久化或客户端渲染。
5. 只把受影响路径与 `upstream/develop` 比较，不把所有 EchoFlow 差异都推断为回归。
6. 只有错误栈或稳定复现支持时，才继续验证 Runtime 或依赖版本假设。

## AI 流式不变量

- Chat、Agent、Dataset 在模型、Provider 和 Secret 校验成功前，不得创建不可用的新会话。
- 上游失败或客户端中止不得按成功生成扣费。
- 即使失败前尚未创建 assistant 消息，客户端也必须显示安全的错误信息。
- Provider 失败应保留有用的状态和错误信息，但不得暴露凭据。

## 工作区所有权

源码、workspace links 和 `node_modules` 应归当前 WSL 用户所有。检查时排除容器数据卷：

```bash
find . -xdev -path './docker/data' -prune -o ! -user "$(id -un)" -print | head
```

需要修复时排除 `docker/data`；数据库和缓存卷可能有意使用容器内的数字用户。只有获得用户明确授权后才能执行所有权修改命令。

Node 容器启动阶段需要 root 安装系统工具，应用进程随后会降权为 `node`。进入已运行容器执行构建、lint 或测试时必须显式使用同一非 root 用户，避免把绑定挂载的源码、`.turbo`、`public/web` 或插件构建目录重新写成 root 所有：

```bash
docker compose exec -u node -e HOME=/home/node nodejs pnpm build
docker compose exec -u node -e HOME=/home/node nodejs pnpm lint
```

若日志出现 `EACCES` 且 PM2 持续重启，先检查目标路径所有权；不要用 root 构建来绕过权限错误。修复所有权后确认 `/consoleapi/health` 返回 200，并检查 PM2 restart count 是否停止增长。

## Docker 与发布检查

- Runtime 版本来自 `.nvmrc`、根 `package.json`、各包 engines 和 `docker-compose.yml`，这些配置必须保持一致。
- 生产 API 服务的是 `public/web`。只完成 Client Vite build 不会刷新生产静态文件，必须使用文档规定的 `build:web` 或部署 release-copy 流程。
- 插件缺少 `build/index.js` 的告警只能说明该插件没有加载，不能单独解释主系统 Chat、Agent、Dataset、认证或 Console 故障。
- 源码修复后先执行最小包级检查。只有用户要求部署运行态，或验证明确需要时，才重新构建或重启 Docker/PM2。
