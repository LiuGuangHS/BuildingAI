# @buildingai/extension-sdk

BuildingAI extension-facing SDK. It exposes helpers and Nest modules that extensions should use instead of duplicating platform integration code.

The public export surface is defined by `src/index.ts` and `package.json.exports`. Keep this README aligned with those files.

## Main exports

### AI/provider helpers

- `AiPublicModule`
- `Output`
- `PublicAiModelService`
- `normalizeProviderConfig`
- `resolveProviderEndpointCredential`
- `resolveProviderSecretValue`
- `normalizeProviderBaseUrl`
- `requestProviderJson`
- `requestProviderText`
- `testProviderJsonEndpoint`
- `safeJsonParse`

Use these for provider config normalization, runtime credential resolution, provider endpoint tests, JSON/text provider requests, and structured JSON parsing.

### Billing

- `ExtensionBillingModule`
- `ExtensionBillingService`
- `ExtensionBillingLogExistsOptions`
- `ExtensionPowerDeductionOptions`

Use these for extension cost deduction, idempotency checks, and refund-related accounting boundaries. Do not mutate user balances directly from an extension.

### User access

- `PublicUserService`

Use this for extension-facing user lookup boundaries exposed by the platform. Do not query or serialize broader user internals from plugins.

### Notifications

- `ExtensionNotificationModule`
- `ExtensionNotificationService`
- `ExtensionNotifyUserInput`
- `ExtensionRegisterNotificationSceneInput`

Use these to register extension notification scenes and emit user notifications through the platform notification system.
Service-only consumers and boundary tests can import `ExtensionNotificationService` from `@buildingai/extension-sdk/notification` without loading the full SDK root entrypoint.

### Rate limiting

- `ExtensionRateLimitService`
- `ExtensionRateLimitOptions`
- `ExtensionRateLimitWindow`

Use this for high-cost public endpoints such as generation, export, prompt optimization, and AI chat actions.

### Public URL and download safety

- `assertPublicHttpUrl`
- `normalizePublicHttpUrl`
- `resolvePublicHttpUrl`
- `downloadPublicHttpUrl`
- `isPrivateOrReservedIp`

Use these before accepting, storing, or downloading external HTTP(S) URLs from users or providers. They are the extension boundary for SSRF-sensitive URL handling.

### Pure utility helpers

- `buildDefinedWhere`
- `safeJsonParse` via the root export
- `./utils/pure` export for pure helpers that should avoid pulling Nest/DB dependencies into browser-safe or pure test contexts

### Build helper

- `defineBuildingAITsupConfig`

Use this in extension `tsup.config.ts` for API build output.

## `defineBuildingAITsupConfig`

Basic usage:

```typescript
import { defineBuildingAITsupConfig } from "@buildingai/extension-sdk";

export default defineBuildingAITsupConfig();
```

Current defaults come from `src/tsup.ts`:

```typescript
{
  entry: ["src/api/**/*.ts"],
  outDir: "build",
  format: ["cjs"],
  dts: false,
  bundle: false,
  sourcemap: process.env.NODE_ENV === "development",
  clean: true,
  splitting: false,
  treeshake: true,
  target: "es2023",
  tsconfig: "tsconfig.api.json",
  skipNodeModulesBundle: false,
}
```

The helper also copies default seed data assets from `src/api/db/seeds/data` into the API `build` output. Additional copy patterns can be supplied through the `assets` option:

```typescript
export default defineBuildingAITsupConfig({
  assets: ["assets/**/*"],
});
```

## Package scripts

```bash
pnpm --filter @buildingai/extension-sdk check-types
pnpm --filter @buildingai/extension-sdk lint
pnpm --filter @buildingai/extension-sdk test
pnpm --filter @buildingai/extension-sdk build
```

Do not run `lint:fix` or `format` by default; they write files.

## Documentation boundary

Repository-wide extension rules live in root `AGENTS.md`. This README documents the package API surface and should not duplicate all plugin development policy.
