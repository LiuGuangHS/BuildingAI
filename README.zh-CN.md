# EchoFlowAI

EchoFlowAI 是基于 BuildingAI 上游项目构建的 AI 应用平台，提供智能体、知识库、模型管理、通知、计费与扩展能力。业务专属功能位于 `extensions/`；主系统只承载可复用的平台能力。

## 快速开始

环境要求：

- Node.js 22.20.x
- pnpm 10.20.0
- Docker 与 Docker Compose（本地 Postgres、Redis）

```bash
cp .env.example .env
# 启动 API 前，请设置至少 32 个字符的唯一 JWT_SECRET。
docker compose up -d
```

服务就绪后，访问 `http://localhost:4090/install` 完成初始化。

本地开发：

```bash
pnpm dev:main
```

## 扩展

独立业务能力应位于 `extensions/<identifier>/`。每个扩展自行维护业务规则、配置、迁移和 UI；共享平台 API 通过 `@buildingai/extension-sdk` 提供。

根构建只校验已启用的本地扩展。`public/web` 是 Git 跟踪的发布产物，只能通过 `scripts/release.mjs` 刷新。

## 桌面客户端

Tauri 桌面客户端是加载已配置生产站点的在线壳，不打包独立前端产物。

## 上游与许可证

EchoFlowAI 保留 BuildingAI 上游历史，并遵循 Apache-2.0 许可证。许可证文本见 [LICENSE](./LICENSE)。
