# EchoFlowAI Client

`packages/client` is the React/Vite/Tauri client for the BuildingAI/EchoFlow workspace.

## Role

- Hosts the main web UI and console routes.
- Embeds extension user pages through `/apps/:identifier/*`.
- Provides the Tauri desktop shell for the remote/web client mode.
- Reuses shared frontend packages from `packages/@buildingai/web/*` and `@buildingai/ui`.

## Important files

- `src/main.tsx` - React entrypoint and provider composition.
- `src/router/index.tsx` - main user, app, dataset, agent, and console routes.
- `src/pages/apps/[identifier]` - extension iframe host route.
- `src/layouts/console` - console/admin layout.
- `vite.config.ts` - Vite config, aliases, dev port, and build behavior.
- `src-tauri/tauri.conf.json` - Tauri desktop configuration.

The desktop package intentionally uses Tauri's remote/web client mode: `frontendDist` points to the EchoFlowAI production site. This is the supported packaging path for this distribution and does not require a local Vite `dist` or `beforeBuildCommand`. Do not convert it back to a bundled local frontend unless the desktop product mode is explicitly changed.

## Common commands

```bash
pnpm -C packages/client dev
pnpm -C packages/client lint
pnpm -C packages/client build:web
pnpm -C packages/client build:desktop
```

Notes:

- `build:web` runs the Vite build and then `scripts/release.mjs`, which copies the built web output into `public/web`.
- The deployment `predeploy` flow performs the same release copy after the workspace build so the API never serves a stale web bundle.
- Treat `public/web` and bundled assets as generated output. Do not edit them by hand.
- Do not run `lint:fix` unless explicitly requested; it can rewrite many files.

## Streaming behavior

- Chat, Agent, and Dataset streams must surface server/provider failures in the message area.
- If a stream fails before an assistant message exists, insert an assistant error message instead of leaving the user message with no visible response.
- Runtime errors should preserve the server-provided message when safe; never expose credentials or raw Secret configuration.

## Extension routing

Extensions are hosted by the main app at `/apps/:identifier/*`; this is the user-facing host route in the client. Extension frontend bundles use their own `/extension/<identifier>/*` base for bundle output and local extension dev URLs, and should be implemented with `defineRouteOption()` / `defineExtensionViteConfig()` in the extension package. Console route documentation should distinguish `consoleRoutes` relative paths such as `/console/...` from full bundle/dev-base URLs such as `/extension/<identifier>/console/...`.

## Verification guidance

Use `/repo-verify` to choose the smallest validation matrix. For client-only changes, start with:

```bash
pnpm -C packages/client lint
```

Run `pnpm -C packages/client build:web` when Vite config, routing, generated assets, shared UI runtime, or production bundle behavior changed.
