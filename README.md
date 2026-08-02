# EchoFlowAI

EchoFlowAI is an AI application platform built on the BuildingAI upstream project. It provides agent, knowledge-base, model-management, notification, billing, and extension capabilities. Product-specific features live in `extensions/`; the main system only contains shared platform capabilities.

## Quick start

Requirements:

- Node.js 22.20.x
- pnpm 10.20.0
- Docker and Docker Compose for the local Postgres and Redis services

```bash
cp .env.example .env
# Set a unique JWT_SECRET with at least 32 characters before starting the API.
docker compose up -d
```

After the services are ready, open `http://localhost:4090/install` to complete initial setup.

For local development:

```bash
pnpm dev:main
```

## Extensions

Independent product capabilities belong under `extensions/<identifier>/`. Each extension owns its business rules, configuration, migrations, and UI. Shared platform APIs are exposed through `@buildingai/extension-sdk`.

The root build validates enabled local extensions. `public/web` is a Git-tracked release artifact and is refreshed only through `scripts/release.mjs`.

## Desktop client

The Tauri desktop client is an online shell that loads the configured production site. It does not bundle a separate frontend distribution.

## Upstream and license

EchoFlowAI retains the BuildingAI upstream history and Apache-2.0 license. See [LICENSE](./LICENSE) for the license text.
