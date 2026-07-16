---
name: echoflow-ui-workflow
description: EchoFlow 插件 UI 设计与前后端契约工作流。用于插件页面从零设计、已有页面迭代、设计沙箱、Design Gallery、2-3 个前端设计稿并行探索、浏览器选择、选中方案迁移、reserved capability 边界、public 字段校验和落选代码清理。
---

# EchoFlow UI Workflow

Use this skill when the user asks for EchoFlow plugin UI design, page redesign, sandbox/design preview, Design Gallery, multiple frontend design drafts, frontend-backend UI contract, capability/public field review, selected-design migration, or rejected-variant cleanup.

Do not use it for pure Vite, Rollup, tsconfig, workspace dependency resolution, build-script, or bundle failures unless the fix changes page design or the Web public contract.

This skill is workflow guidance only. It does not override `AGENTS.md`, `CLAUDE.md`, target plugin README, `package.json`, `manifest.json`, or source code facts.

## Required reading

Always read:

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/design-workflow.md`
4. `extensions/<identifier>/README.md`
5. `extensions/<identifier>/package.json`
6. `extensions/<identifier>/manifest.json`
7. `extensions/<identifier>/src/web/routes.tsx`

For iteration, also read:

- Target page files.
- Target components.
- Web services and service types used by the page.
- Existing lazy imports and heavy dependencies on the default route.

For API, capability, upload, billing, Secret, provider, raw response, or queue-state UI changes, also read:

- Relevant controllers.
- DTOs.
- Services.
- Public/admin serializers.
- `extensions/<identifier>/src/web/services/**`.
- `extensions/<identifier>/src/web/services/types/**`.
- Relevant tests.
- `packages/api/ai-rules.md` when main API, AI, Secret, provider, upload, queue, or billing boundaries are involved.

## Mode selection

Choose exactly one mode and state it before planning.

### Mode A: Direct UI edit

Use when the change is copy, spacing, one component, a clear bugfix, or a low-risk implementation with no design uncertainty and no API/capability change.

### Mode B: Iteration Design Gallery

Use when an existing page or component is being redesigned, layout/workflow alternatives are useful, desktop/mobile comparison matters, or the user asks for multiple designs.

### Mode C: New UI / New Feature

Use when creating a new page, new workflow, new plugin surface, or a UI whose backend contract is unclear.

### Mode D: Contract-only

Use when the user only asks whether fields, capabilities, or UI actions are safe/possible to expose and no UI code is needed yet.

## Workflow

1. Discover current source facts and plugin README facts.
2. Produce a Contract Brief.
3. For iteration, produce a Current UI Snapshot.
4. Decide whether Design Gallery is needed.
5. If needed, use a plugin-local dev-only `__design` route.
6. Produce 2 variants by default, max 3.
7. Use public-shaped mock fixtures only.
8. Cover the full decision surface when relevant: model loading/error/empty, estimate idle/loading/error, pending, processing, square/landscape/portrait/multiple success, failed, disabled/reserved, history reuse, image actions, and mobile.
9. Treat responsive behavior as real composition, not a narrow desktop container: use actual browser viewport resizing for evidence, or build an explicit mobile composition/container-query preview.
10. Ask the user to choose after browser review.
11. Migrate the selected variant only.
12. Delete rejected variants, unused fixtures, temporary CSS, screenshots, TODOs, and copied dead components.
13. Use targeted reviewers when the changed area warrants it.
14. Run or recommend `/repo-verify` for the smallest relevant verification matrix.

## Contract Brief template

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

## Current UI Snapshot template

Use for Mode B.

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

## Design Gallery rules

- Design inside the real plugin, not a standalone app or separate artifact project.
- Use a dev-only route, normally `/extension/<identifier>/__design`.
- Put user-facing design sandboxes in normal Web `routes`, not `consoleRoutes`, unless explicitly designing Console UI.
- Do not duplicate host Header, account area, global navigation, marketing Hero, standalone sidebar, or full app shell.
- Do not create a new `QueryClientProvider` when the plugin already runs under the extension RootLayout.
- Use `@buildingai/ui`, Tailwind utilities, and `cn()`.
- Custom CSS uses the plugin prefix, such as `ef-image-*` for `echoflow-image`.
- Do not call real generation, estimate, billing, upload, Secret, provider, queue, or raw APIs in sandbox.
- Fixtures must be public-shaped and must not include `secretId`, Base URL, API Key, `rawRequest`, `rawResponse`, `rawEvents`, provider internals, upstream task IDs, or admin notes.
- Reserved capabilities must stay disabled, hidden, or clearly marked reserved.
- Do not statically import sandbox pages, fixtures, or variants from production pages.

## Variant rules

- Default to 2 variants.
- Use 3 when the user explicitly asks for breadth, the page is being substantially redesigned, or decision risk is high. Three strong directions are better than two incomplete ones; do not cap functional coverage to save code or tokens.
- Variants must differ in at least two of: primary task priority, spatial structure, information density, interaction rhythm, mobile downgrade, implementation risk, component reuse strategy.
- Do not create pseudo-variants that only change color, radius, title, or icon.
- Each variant must state what it optimizes, what it sacrifices, and one subject-specific signature element users will remember.
- Build prototypes as interactive HTML/React compositions with local state: controls should be comparable and actions should produce local feedback, while network and business mutations remain disabled.
- A mobile toggle that only applies `max-width: 390px` is not responsive evidence when Tailwind/media-query breakpoints still use the outer desktop viewport.

## Sandbox route pattern

Prefer this structure in `routes.tsx`:

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

Insert `...createDevRoutes()` into normal `routes` after the index route. Do not declare the sandbox lazy import at module top level.

If the plugin lacks Vite env typing, add:

```ts
/// <reference types="vite/client" />
```

## Selection matrix

Use one matrix for all variants:

| Dimension | Question |
|---|---|
| Business task | Does it make the primary task faster/clearer? |
| Contract match | Does it only rely on public ready fields? |
| Capability | Does it avoid implying reserved features are ready? |
| Plugin boundary | Does it avoid duplicating the host shell? |
| Implementation cost | Can it reuse existing components? |
| First-screen risk | Does it avoid pulling heavy dependencies into default route? |
| Mobile | Does it work around 390px? |
| Cleanup | Are rejected variants easy to delete? |

## Migration rules

- Migrate only the selected variant.
- Prefer existing component composition, props, or variants before adding new components.
- Do not import sandbox fixtures, rejected variants, or temporary design notes into production pages.
- Do not turn unimplemented capabilities into real clickable actions.
- If the selected UI needs backend fields, update DTO/service/serializer/tests before hardening the UI.
- Re-check first-screen lazy/import boundaries after migration.

## Cleanup rules

Before handoff, delete:

- Rejected variant files.
- Unused fixtures.
- Unused CSS classes.
- Temporary screenshots or large design artifacts.
- Temporary TODO/FIXME notes.
- Copied dead component variants.
- Dependencies no longer needed.

A lightweight dev-only `design-sandbox.tsx` shell and minimal public mock fixture may remain.

## Reviewer routing

Use or recommend:

- `extension-ui-contract-reviewer` for extension frontend UI, Design Gallery, sandbox isolation, capability/public contract, first-screen dependency, and rejected variant cleanup.
- `extension-boundary-reviewer` for extension metadata, dependency/script, release, package, and README boundaries.
- `security-boundary-reviewer` for API, Secret, provider, upload, billing, queue, DTO, public serializer, or backend capability changes.
- `/repo-verify` before handoff to choose the smallest relevant verification commands.

## Output requirements

Always include:

1. Mode chosen.
2. Files read.
3. Contract Brief.
4. Current UI Snapshot when iterating.
5. Variant plan or direct-edit reason.
6. Implementation plan.
7. Cleanup plan.
8. Verification plan.
9. Whether `AGENTS.md`, `CLAUDE.md`, a skill, or plugin README needs updating.
