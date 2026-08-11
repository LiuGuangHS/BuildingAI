# echoflow-video Roadmap

## 当前阶段：A7 单视频真实生产闭环

状态：`code-ready / real-smoke-blocked`

本阶段只覆盖单视频生成，不实现短剧实体、批量镜头、配音、合成、Studio、Remotion、Temporal、FFmpeg 或新的 npm 依赖。

### 已完成的代码边界

- HTTP 创建接口只接收稳定的 `modelConfigId`，不再把历史 `model` 快照当作可执行标识。
- 创建接口完成校验、计费预检、写入 `PENDING` 并加入 `echoflow-video-generation` BullMQ 队列。
- Redis job data 只有 generation ID；Worker 使用 `attempts: 1`，重新从数据库读取模型、素材和账务事实。
- Worker 通过条件更新抢占 `PENDING → PROCESSING`，Provider I/O 不在长数据库事务内。
- 只开放已验证的文生视频和单首帧图生视频；未验证能力在模型目录、Web 和后端均 fail closed。
- 扣费在 Worker 内按 generation ID 幂等执行；成功必须有有效结果视频。
- 失败终态统一经过锁定事务；退款失败保留受限元数据，启动与定时扫描会按账务事实重试，退款未结算的失败任务不能重试。
- 旧 `PENDING` 恢复使用数据库悲观锁 claim 后再入队；旧 `PROCESSING` 超时失败，不自动重放已经开始的 Provider 工作。
- 结果文件在终态竞争失败时回收；public serializer 使用显式白名单。
- `0.0.2` 增量升级补齐当前模型配置列、解除历史旧列非空约束、创建主站模型唯一索引、禁用无法确认绑定或未验证契约的旧配置，并同步扩展版本记录。

### 当前验证证据

| 验证类别 | 状态 | 证据 |
|---|---|---|
| Node 边界测试 | current | `find extensions/echoflow-video/tests -name '*.test.mjs' -print0 \| xargs -0 node --experimental-strip-types --test`，67/67 通过。 |
| JSON/diff 静态检查 | current | package、manifest、extensions registry JSON 解析通过；`git diff --check` 通过。 |
| TypeScript/Jest/API/Web build | blocked | 当前 shell 没有 `pnpm`，尚未重新执行。 |
| PostgreSQL 升级 | blocked | 未提供 disposable `VIDEO_TEST_DATABASE_URL`；没有执行数据库写入。 |
| Redis/Worker 并发恢复 | blocked | Redis/Worker 测试环境未提供，未启动服务。 |
| 主站模型、Secret、余额、存储 smoke | blocked | 未提供真实环境变量或显式生成开关，未调用 Provider、账务、退款或通知。 |
| 浏览器 QA | pending | 需要可用的 Web/API 服务和认证环境；当前未启动服务。 |

### 必须补齐的真实验收

1. 在一次性 PostgreSQL 中从已执行 `0.0.1` 状态运行 `0.0.2`，验证旧表新配置 INSERT/UPDATE、唯一索引、旧配置下线和 extension version 更新。
2. 在 Redis 上启动两个 Worker，验证相同 PENDING 任务只有一个恢复 claim 和一个有效入队，PROCESSING 超时不会重放 Provider。
3. 使用测试模型、测试 Secret、测试余额、测试素材和可写存储执行：成功生成、Provider 可控失败退款、退款失败恢复、重复 requestKey、Worker 中断恢复和终态通知。
4. 使用 Playwright/Chrome DevTools 验证桌面和 390px 页面，确认原模型不可用时不会静默切换模型，且只有已验证能力显示。

### 约束

- 未完成上述真实验收前，不把 A7 标为真实生产闭环完成。
- 不用 mock、静态源码测试、历史构建产物或 roadmap 文档替代真实 Provider、账务、Redis、PostgreSQL 和安装升级证据。
- 继续开发时优先修复 A7 的验证阻塞；A7 完成前不进入短剧工作流或 Studio 正式实现。
