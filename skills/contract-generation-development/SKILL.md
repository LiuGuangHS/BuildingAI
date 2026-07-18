---
name: contract-generation-development
description: 合同插件后续开发、真实联调、审查规则、编辑冲突、Open File Viewer 和交付收口流程。触及 echoflow-contract-generation 时读取。
---

# Contract Generation Development

本 skill 只负责工作流和验收顺序；合同产品事实、当前状态和完整路线图以 `extensions/echoflow-contract-generation/README.md` 为准，跨仓库规则以 `AGENTS.md` 为准。

## 开始前

按顺序读取：

1. `AGENTS.md`
2. `extensions/echoflow-contract-generation/README.md`
3. `extensions/echoflow-contract-generation/package.json`
4. `manifest.json`、`src/web/routes.tsx`、相关 API/Web 入口
5. `skills/repo-verify/SKILL.md`
6. 涉及 UI 时读取 `skills/echoflow-ui-workflow/SKILL.md`

先检查 `git status --short --branch`，保留用户已有改动。README 中的规划不是实现证据，必须对照源码和测试。

## 当前交接阶段

当前本地 v1 代码和构建已经通过；下一对话优先完成 README 的“当前交接阶段”任务，完成全部验收后，本轮合同插件任务暂时收口：

1. 真实主系统登录态下完成起草、编辑、保存、审查、采纳、再次审查和 Word 导出。
2. 完成 Redis/Worker 入队失败、重启恢复、重复执行、超时补偿、软删除回写和退款异常验证。
3. 完成真实模型、Secret、上传、扣费和失败退款测试；日志只记录脱敏 ID 和状态。
4. 补强金额一致性、未定义术语和跨条款语义冲突规则，并建立服务合同质量 fixture。
5. 完成两个客户端并发保存、本地草稿恢复、冲突选择和版本链集成测试。
6. 接入现有 Open File Viewer 或平台文件预览能力，实现 PDF/DOCX 原文、页码和 Finding 证据跳转。
7. 重跑类型、测试、lint、`build:api`、`build:web`、`build:publish`，更新 README 验证证据和剩余风险。

## 安全与验证

- 不默认执行 `pnpm install`、依赖升级、Docker/PM2 生命周期、数据库写入或真实模型调用；需要时先说明外部影响。
- 不使用 `sudo pnpm`；Docker 内执行必须使用 `docker compose exec --user node -e HOME=/home/node nodejs pnpm <command>`。
- 修复权限时停止 Node 容器，修复 UID 0/65534，排除 `docker/data`，不对整个 home 无差别 `chmod -R`。
- 真实 smoke 使用测试账号、测试余额、测试 Secret 和测试文件，记录任务 ID、fileId、associationNo、状态和导出文件，不记录密钥或 raw 响应。
- 代码改动按 `repo-verify` 选择最小检查；API/Web/迁移/DTO/队列/计费边界必须有对应回归测试。
- 每完成一个阶段，更新插件 README 的状态、验证证据、风险和下一步；已完成任务不得继续留在下一步表格。

## 长期路线

完成当前交接阶段后，再按 README 的 P2/P3 路线推进：合同类型扩展、原文与修订版 redline、多人批注和审批、企业模板/规则中心、Agent 多步骤编排、工具调用和知识库、批量合同处理、统计审计、国际化和发布运营。Agent 化必须建立在稳定的 DraftSpec、Finding、revision、文件证据和账务边界之上，不先引入新的 Agent 框架或依赖。

## 交付检查

- README、AGENTS、相关 skill 和生成副本事实一致。
- API/Web 构建产物归当前用户，容器数据卷所有权未被误改。
- 真实 smoke 的外部条件、未执行项目和失败原因有记录。
- 下一对话可以只读本 skill、插件 README、AGENTS 和源码继续，不依赖本次聊天上下文。
