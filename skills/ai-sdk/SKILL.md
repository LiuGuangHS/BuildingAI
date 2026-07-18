---
name: ai-sdk
description:
    "Answer questions about the AI SDK and help build AI-powered features. Use when developers: (1)
    Ask about AI SDK functions like generateText, streamText, ToolLoopAgent, or tools, (2) Want to
    build AI agents, chatbots, or text generation features, (3) Have questions about AI providers
    (OpenAI, Anthropic, etc.), streaming, tool calling, or structured output."
metadata:
    author: Vercel Inc.
    version: "1.0"
---

## BuildingAI repository guardrails

When working in this repository, first check the actual package versions and boundaries in
`package.json`, `pnpm-workspace.yaml`, and `skills/project-architecture/references/ai-sdk.md`. For
main-system Chat, Agent, Dataset, Provider, Secret, SSE, Abort, or billing behavior, also read
`packages/api/ai-rules.md` and the affected source path. Dependency governance lives in
`pnpm-workspace.yaml`; do not upgrade `ai`, provider packages, or catalog entries by default.

If a task needs a newer AI SDK API, use the Codex runtime Context7 when available or current official
docs to confirm the API, then explain the version impact and get explicit authorization before
changing dependencies, catalogs, overrides, or lockfiles. Ordinary EchoFlow plugins should prefer
platform public model services and `@buildingai/extension-sdk` helpers instead of low-level provider
integration.

## AI SDK Documentation

When you need up-to-date information about the AI SDK:

### If using ai@6.0.34 or above

Search the bundled documentation and source code in `node_modules/ai/`:

1. **Documentation**: `rg "your query" node_modules/ai/docs/`
2. **Source code**: `rg "your query" node_modules/ai/src/`

To find specific files:

- `rg --files node_modules/ai/docs -g '*.mdx'` for documentation files
- `rg --files node_modules/ai/src -g '*.ts'` for source files

Provider packages (`@ai-sdk/openai`, `@ai-sdk/anthropic`, etc.) also include bundled docs in their
respective `node_modules/@ai-sdk/<provider>/docs/` directories.

**When in doubt in BuildingAI, verify the repository's current version and docs first. Do not update to the latest version unless the user explicitly authorizes the dependency change after an impact explanation.**

### Otherwise

1. Search the docs: `https://ai-sdk.dev/api/search-docs?q=your_query`
2. The response includes matches with links ending in `.md`
3. Fetch those `.md` URLs directly to get plain text content (e.g.
   `https://ai-sdk.dev/docs/agents/building-agents.md`)

Use these resources for current API details, examples, and usage patterns.

For common errors and troubleshooting, see [Common Errors Reference](references/common-errors.md).

For using Vercel AI Gateway, see [AI Gateway Reference](references/ai-gateway.md).

## Provider-Specific Information (ai@6.0.34+)

For questions about specific providers (OpenAI, Anthropic, Google, etc.), search their dedicated
packages:

1. **Provider documentation**: `rg "your query" node_modules/@ai-sdk/<provider>/docs/`
2. **Provider source code**: `rg "your query" node_modules/@ai-sdk/<provider>/src/`

To find provider files:

- `rg --files node_modules/@ai-sdk/<provider>/docs -g '*.mdx'` for provider documentation
- `rg --files node_modules/@ai-sdk/<provider>/src -g '*.ts'` for provider source files

This is especially important for `providerOptions`, which are provider-specific settings passed to
model calls. Each provider has unique options documented in their package.
