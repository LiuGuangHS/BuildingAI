# @buildingai/ai-sdk

`packages/@buildingai/ai-sdk/` is the current AI SDK package in this repository. Do not reference a separate replacement AI SDK package; it does not exist in the current workspace.

## Source files

- Package root: `packages/@buildingai/ai-sdk/`
- Public exports: check `packages/@buildingai/ai-sdk/src/index.ts` and package `exports`.
- Extension-facing AI helpers are exposed through `packages/@buildingai/extension-sdk/src/index.ts` when plugins should not use low-level provider APIs directly.

## Usage boundary

- Main-system AI modules may use `@buildingai/ai-sdk` for provider integration, chat, embeddings, speech, image, moderation, rerank, and related low-level AI operations.
- Ordinary EchoFlow plugins should prefer main-system public model services and `@buildingai/extension-sdk` helpers unless they are implementing a protocol/integration layer.
- Provider credentials and Base URL handling should go through the platform Secret/provider flow; do not duplicate secret flattening or URL validation in plugins.

## Related docs

- Cross-repo AI/Secret/billing/upload rules: `AGENTS.md`.
- Extension SDK package API: `packages/@buildingai/extension-sdk/README.md`.
- Path-aware verification: `skills/repo-verify/SKILL.md`.
