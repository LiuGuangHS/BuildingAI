# EchoFlow 插件 UI 设计与前后端契约工作流

本文件定义 EchoFlow 插件 UI 从零设计、迭代改版、设计沙箱、多方案选择、真实迁移和清理验证的执行流程。它是流程手册，不是新的事实源；不能覆盖 [AGENTS.md](../AGENTS.md)、目标插件 README、`package.json`、`manifest.json` 或源码事实。

## 1. 目标

- 让插件 UI 设计发生在真实插件环境中，而不是脱离主系统 RootLayout、主题、路由和业务组件的独立原型。
- 在写真实业务代码前，先明确前后端契约、public 字段、ready/reserved capability 和禁止暴露字段。
- 用 dev-only Design Gallery 一次性生成 2 个默认、最多 3 个高保真方案，便于浏览器选择。
- 选择后只迁移选中方案，删除未选方案、临时 fixture、临时 CSS 和 TODO。
- 通过 reviewer、最小验证矩阵和文档收口，避免设计稿污染生产代码或长期事实源。

## 2. 适用范围

必须使用本流程：

- 新插件用户端页面、新工作台或新用户流程。
- 已有插件首页、工作台、结果区、历史区、表单区、画布区等页面级重构。
- 用户要求“多个设计稿”“2-3 个方案”“沙箱”“design preview”“Design Gallery”或浏览器对比选择。
- UI 依赖新的 Web public 字段、capability、生成状态、上传、计费、Secret、provider、raw response 或 queue 状态展示。
- 设计可能影响桌面/移动端信息架构、首屏依赖、插件边界或 reserved 能力表达。

可以跳过 Design Gallery、直接小改：

- 文案、间距、小样式或单组件 bugfix。
- 明确方案的小范围实现。
- Console 表格/表单字段小调整，且不涉及用户端体验探索。
- 纯后端、安全、DTO、队列、计费或测试改动，没有 UI 视觉探索。
- 纯 Vite、Rollup、tsconfig、workspace 依赖解析、构建脚本或 bundle failure；除非修复会改变页面设计或 Web public contract，否则不加载 Design Gallery 或多方案流程。

即使跳过 Design Gallery，只要涉及 Web public 字段或 capability 变化，仍要做简短 Contract Brief。

## 3. 权威顺序

1. 机器事实：`package.json`、`.nvmrc`、`pnpm-workspace.yaml`、`extensions/extensions.json`、目标插件 `package.json` / `manifest.json`。
2. 源码事实：API controller、DTO、serializer、service、web service types、frontend routes/pages/components。
3. [AGENTS.md](../AGENTS.md)：跨插件边界、安全、验证和文档治理。
4. 目标插件 README：单插件业务目标、入口、能力状态、风险和验证证据。
5. 本文件：UI 设计与前后端契约流程。
6. `echoflow-ui-workflow` skill 输出：当前任务执行建议。

若发现冲突，以更高层级为准，并更新低层文档或 skill，避免形成第二套事实源。

## 4. 工作模式

### Mode A：直接 UI 小改

适用：文案、小间距、单组件状态 bug、已确定方案的小实现。

要求：

- 仍遵守 `AGENTS.md` 的嵌入式 UI 规则。
- 不重复宿主 Header、账号、全局导航、营销 Hero 或完整应用壳。
- 不引入新的 provider/raw/secret/Base URL 字段。
- 改完按 `/repo-verify` 或最小验证矩阵收口。

### Mode B：迭代 Design Gallery

适用：已有页面改版或需要比较多个方向。

步骤：

1. 读取现有页面、组件、服务类型、插件 README。
2. 输出 Current UI Snapshot。
3. 输出 Contract Brief。
4. 在插件内 dev-only `__design` route 中生成 2 个默认、最多 3 个方案。
5. 浏览器选择后，只迁移选中方案。
6. 删除落选方案和临时资源。

### Mode C：从零 UI / 新功能

适用：新页面、新工作台、新插件用户端入口或后端契约尚未明确的功能。

步骤：

1. 先做 Contract Brief 和 Backend Capability Matrix。
2. 明确后端缺口：DTO、serializer、service、tests、capability、计费、上传、provider。
3. 只用 public-shaped mock fixture 做 Design Gallery。
4. 选中方案后，再补真实前后端接线。
5. 对 API / Secret / provider / upload / billing 变更，使用安全边界 reviewer。

### Mode D：契约-only

适用：用户只问某字段、capability 或 UI 能力是否能展示，不需要写 UI。

输出：

- 当前 public 字段。
- Console-only 字段。
- 禁止字段。
- ready/reserved capability。
- 后端缺口和测试建议。

## 5. Contract Brief 模板

每次页面级 UI 设计或 capability/public 字段变化前，先产出：

```md
# Contract Brief

## Target
- 插件：
- 页面/流程：
- 首要用户任务：

## Current public data
- Web 用户端可展示字段：
- Web service/types 来源：

## Console-only / forbidden data
- secretId：禁止
- Base URL：禁止
- API Key：禁止
- rawRequest/rawResponse/rawEvents：禁止
- provider internals：禁止
- upstream task ID：禁止
- admin notes：禁止

## Capabilities
- ready：
- reserved：
- disabled in UI：
- hidden from UI：

## Required UI states
- empty：
- loading：
- success：
- failed：
- disabled/reserved：
- mobile：

## Backend gaps
- 需要新增 public field：
- 需要 serializer 白名单变更：
- 需要 DTO/service 变更：
- 需要 capability 变更：
- 是否涉及计费/上传/Secret/provider/queue：
- 需要新增或更新的测试：
```

## 6. Current UI Snapshot 模板

迭代已有页面时先产出：

```md
# Current UI Snapshot

## Page
- 路由：
- 页面文件：

## Current components
- 组件：
- hooks/services：
- 关键状态：

## Current constraints
- 不能破坏的布局：
- 不能破坏的 public 字段：
- 不能开放的 reserved 能力：
- 首屏 lazy/import 边界：

## Current problems
- 信息层级：
- 移动端：
- loading/error/empty：
- 用户困惑点：
- 实现债务：
```

## 7. Design Gallery 规范

Design Gallery 是插件内开发期页面，用于浏览器比较 2-3 个高保真方案。

标准路由：

```txt
/extension/<identifier>/__design
```

推荐结构：

```txt
顶部：任务说明 + Contract Brief 摘要
中部：方案 tabs
下方：当前方案 preview
侧边或底部：方案比较矩阵
状态切换：model loading/error/empty、estimate idle/loading/error、pending、processing、square/landscape/portrait/multiple success、failed、reserved
视口切换：responsive / desktop / mobile
```

要求：

- 必须在目标插件内实现。
- 默认普通 Web route，不放入 `consoleRoutes`，除非明确设计 Console UI。
- 必须 dev-only，生产构建不注册路由、不静态 import 页面。
- 不调用真实生成、扣费、上传、Secret、provider、queue 或 raw API。
- 只使用 public-shaped mock fixture。
- 不重复主系统 Header、账号、全局导航、营销 Hero、完整应用壳。
- 不新建 `QueryClientProvider`。
- UI 优先 `@buildingai/ui`、Tailwind、`cn()`。
- 自定义 CSS 使用插件前缀，例如 `ef-image-*`。
- 响应式证据必须来自真实浏览器 viewport resize，或明确的移动端 composition/container query；在桌面 viewport 中只给容器设置 `max-width: 390px`，不能证明 Tailwind/media-query 布局在移动端成立。
- 成功态至少覆盖方图、横图、竖图和多图，媒体类插件不得只用一种占位比例完成设计决策。

## 8. 方案数量与差异标准

- 默认 2 个方案。
- 用户明确要求更广探索、页面大改或决策风险高时做 3 个方案；不能为了少写代码而缩减状态、交互或响应式覆盖。
- 每个方案必须至少在两个维度上有实质差异：
  - 首要任务优先级。
  - 空间结构。
  - 信息密度。
  - 交互节奏。
  - 移动端降级。
  - 实现风险。
  - 复用/改造现有组件的方式。
- 禁止只做颜色、圆角、标题或图标变化的伪方案。
- 每个方案必须写清它优化什么、牺牲什么，以及一个来自业务场景、可被记住的 signature element。
- 原型使用本地 state 提供真实的控件切换、选图、模板应用、重试/复用/画布动作反馈；这些动作不得调用真实网络或业务 mutation。
- 功能覆盖应以决策所需状态为准，不以 token 或文件长度为理由删减重要场景。

## 9. Fixture 规范

- fixture 必须模拟 Web public 数据，不模拟 Console-only 或 provider/raw 数据。
- 推荐用 `satisfies` 绑定现有 Web service type，防止设计稿使用不存在字段。
- 不得包含：`secretId`、Base URL、API Key、`rawRequest`、`rawResponse`、`rawEvents`、provider internal fields、upstream task ID、admin notes。
- reserved capability 应以 `false`、`reserved`、`disabled` 或隐藏表达，不得设计成可提交真实能力。
- fixture 文件只允许被 dev-only sandbox 引用，不允许被生产页面静态 import。

示例：

```ts
import type { PublicGenerationRecord } from "../../services/types/generation";

export const successGeneration = {
    id: "mock-generation-1",
    status: "succeeded",
    prompt: "一张品牌海报",
    images: [],
} satisfies PublicGenerationRecord;
```

## 10. Sandbox route 实现规范

推荐在 `routes.tsx` 中使用函数包裹 dev-only route：

```tsx
import type { RouteObject } from "react-router-dom";

function createDevRoutes(): RouteObject[] {
    if (!import.meta.env.DEV) {
        return [];
    }

    const DesignSandboxPage = lazy(() => import("./pages/dev/design-sandbox"));

    return [
        {
            path: "__design",
            element: (
                <LazyPage>
                    <DesignSandboxPage />
                </LazyPage>
            ),
        },
    ];
}
```

并插入普通 `routes`：

```tsx
routes: [
    {
        index: true,
        element: <LazyPage><PublicPage /></LazyPage>,
    },
    ...createDevRoutes(),
    // production routes
],
```

禁止：

- 在模块顶层静态声明 sandbox lazy import。
- 将用户端设计沙箱放进 `consoleRoutes`。
- 在生产页面 import sandbox fixture 或 variant。

若目标插件缺少 Vite env 类型，新增：

```ts
/// <reference types="vite/client" />
```

## 11. 前后端交接规则

- UI 只能消费 Web public serializer 暴露的字段。
- 若 UI 需要新字段，先在 Contract Brief 中标记 backend gap。
- 后端新增字段必须走 DTO/service/serializer 白名单和测试。
- Console-only 字段不能为了 UI 方便下放到 Web。
- capability 必须由后端收敛，前端不能绕开后端 capability 白名单。
- 生成、上传、计费、Secret、provider、queue 相关改动需要安全边界复核。

## 12. 选择矩阵

选择方案时按同一矩阵评估：

| 维度 | 问题 |
|---|---|
| 业务任务 | 是否更快完成首要任务 |
| 契约匹配 | 是否只依赖 public ready 字段 |
| capability | 是否没有误开放 reserved 能力 |
| 插件边界 | 是否不重复宿主壳 |
| 实现成本 | 是否复用现有组件 |
| 首屏风险 | 是否没有把重依赖带进默认路径 |
| 移动端 | 390px 是否成立 |
| 清理成本 | 落选方案是否容易删除 |

选择结论记录在 PR、issue、任务交付说明或短期计划中；不要把临时方案评审长期堆进插件 README。

## 13. 选中方案迁移规则

- 只迁移选中方案。
- 优先改已有组件组合、props 或 variant，再考虑新增组件。
- 真实页面不得 import sandbox fixture、落选 variant 或临时设计说明。
- 真实页面不得调用未上线 capability。
- 如需要后端补字段，先补契约和测试，再接 UI。
- 迁移后复核首屏 lazy/import 边界，避免把 tldraw、图表、大 fixture 或不必要 lucide 静态带入默认路径。

## 14. 落选方案清理规则

合并前必须删除：

- 未选 variant 文件。
- 未用 fixture。
- 未用 CSS class。
- 临时截图或大素材。
- 临时 TODO / FIXME。
- 从真实组件复制出的废弃副本。
- 不再需要的依赖。

可以保留：

- 轻量 dev-only `design-sandbox.tsx` 壳。
- 最小 public mock fixture。
- 已被真实页面使用的提取组件。
- PR/issue/交付说明中的设计决策摘要。

## 15. 验证矩阵

根据变更范围选择最小验证：

- 文档/skill-only：检查路径、链接、frontmatter、skill 同步状态；通常不需要产品构建。
- 插件 Web：`pnpm --filter <identifier> check-types`、`pnpm --filter <identifier> test`，必要时 `pnpm --filter <identifier> build:web`。
- 插件 API / serializer / capability：加 `pnpm --filter <identifier> build:api` 和相关测试。
- Design Gallery：dev 路由可打开，默认首页可打开，生产构建不含 `__design` / `design-sandbox` 字符串。
- 发布交付：调用 `/extension-release-check`。
- 交付前：优先调用 `/repo-verify`。

若验证失败或环境阻塞，必须写清命令、错误和后续条件。

## 16. 自动化路由

- `echoflow-ui-workflow` skill：插件 UI 设计、Design Gallery、多方案、前后端 UI 契约的主入口。
- `extension-boundary-reviewer`：插件 metadata、脚本、依赖、发布边界复核。
- `security-boundary-reviewer`：API、Secret、provider、上传、计费、队列、public serializer 复核。
- `extension-ui-contract-reviewer`（如存在）：UI 契约、Design Gallery dev-only、首屏依赖和落选方案清理复核。
- `/repo-verify`：交付前最小验证矩阵。

## 17. 交付说明模板

```md
## UI Workflow Handoff

- 模式：Direct / Iteration Gallery / New UI / Contract-only
- 已读文件：
- Contract Brief 摘要：
- 方案数量与差异：
- 用户选择：
- 迁移文件：
- 删除的落选代码：
- reviewer / skill 使用：
- 验证命令与结果：
- 未执行验证与原因：
- 文档是否需要更新：
```
