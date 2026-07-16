#!/usr/bin/env node
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const rootDir = process.cwd();

function readHookInput() {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

function normalizePath(filePath) {
    if (!filePath || typeof filePath !== "string") return null;
    const absolutePath = path.isAbsolute(filePath)
        ? path.normalize(filePath)
        : path.resolve(rootDir, filePath);
    const relativePath = path.relative(rootDir, absolutePath);

    if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) {
        return relativePath.split(path.sep).join("/");
    }

    return null;
}

function statePath(sessionId) {
    const safeId = String(sessionId || "unknown").replace(/[^a-zA-Z0-9_.-]/g, "_");
    return path.join(tmpdir(), `buildingai-claude-verify-${safeId}.txt`);
}

function candidateFiles(input) {
    const toolInput = input.tool_input || {};
    const toolResponse = input.tool_response || {};
    return [
        toolInput.file_path,
        toolInput.path,
        toolInput.notebook_path,
        toolResponse.filePath,
        toolResponse.file_path,
        ...(Array.isArray(toolInput.files) ? toolInput.files : []),
    ]
        .map(normalizePath)
        .filter(Boolean);
}

function recordTouchedFiles(input) {
    if (!input.session_id) return;
    const files = candidateFiles(input);
    if (!files.length) return;

    const filePath = statePath(input.session_id);
    const existing = existsSync(filePath)
        ? readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean)
        : [];
    const merged = Array.from(new Set([...existing, ...files]));
    writeFileSync(filePath, `${merged.join("\n")}\n`);
}

function readTouchedFiles(input) {
    if (!input.session_id) return [];
    const filePath = statePath(input.session_id);
    if (!existsSync(filePath)) return [];

    const files = readFileSync(filePath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    rmSync(filePath, { force: true });
    return Array.from(new Set(files));
}

function addCommand(commands, command, reason) {
    if (!commands.has(command)) {
        commands.set(command, new Set());
    }
    commands.get(command).add(reason);
}

function packageNameForSharedPackage(file) {
    const match = file.match(/^packages\/@buildingai\/([^/]+)\//);
    return match ? `@buildingai/${match[1]}` : null;
}

function extensionName(file) {
    const match = file.match(/^extensions\/([^/]+)\//);
    return match ? match[1] : null;
}

function buildHints(files) {
    const commands = new Map();
    const notes = new Set();
    let touchedDesignWorkflow = false;
    const docsOrClaudeOnly = files.length > 0 && files.every(
        (file) =>
            /(^|\/)README\.md$/.test(file) ||
            file === "AGENTS.md" ||
            file === "CLAUDE.md" ||
            file.startsWith("skills/") ||
            file.startsWith(".claude/") ||
            file === ".mcp.json",
    );

    if (docsOrClaudeOnly) {
        notes.add("仅协作文档、Claude Code 配置或 skill 变更通常不需要产品构建；请检查 JSON/脚本语法、路径、命令和路由与现有事实一致。");
        return { commands, notes };
    }

    for (const file of files) {
        if (
            file === ".claude/design-workflow.md" ||
            file.startsWith("skills/echoflow-ui-workflow/") ||
            file.startsWith(".claude/skills/echoflow-ui-workflow/") ||
            /^extensions\/[^/]+\/src\/web\/pages\/dev\//.test(file) ||
            /^extensions\/[^/]+\/src\/web\/routes\.tsx$/.test(file)
        ) {
            touchedDesignWorkflow = true;
        }

        if (/^(package\.json|pnpm-workspace\.yaml|turbo\.json|pnpm-lock\.yaml)$/.test(file)) {
            addCommand(commands, "pnpm typecheck", "workspace/package manager configuration changed");
            addCommand(commands, "pnpm lint", "workspace/package manager configuration changed");
            notes.add("依赖或 workspace 变更如涉及 lockfile，请人工确认是否需要 `pnpm install --no-frozen-lockfile`；不要由 hook 自动执行 install。");
            continue;
        }

        if (file.startsWith("packages/api/")) {
            addCommand(commands, "pnpm --filter @buildingai/api check-types", "API source/config changed");
            addCommand(commands, "pnpm --filter @buildingai/api lint", "API source/config changed");
            if (/\.spec\.ts$|test\//.test(file)) {
                addCommand(commands, "pnpm --filter @buildingai/api test", "API tests changed");
            }
            continue;
        }

        if (file.startsWith("packages/client/")) {
            addCommand(commands, "pnpm -C packages/client lint", "client source/config changed");
            if (/\.(ts|tsx|css|json|html)$/.test(file) || file.includes("vite.config")) {
                addCommand(commands, "pnpm -C packages/client build:web", "client build-impacting files changed");
            }
            continue;
        }

        const sharedPackage = packageNameForSharedPackage(file);
        if (sharedPackage) {
            addCommand(commands, `pnpm --filter ${sharedPackage} check-types`, `${sharedPackage} changed`);
            if (/test|spec/.test(file)) {
                addCommand(commands, `pnpm --filter ${sharedPackage} test`, `${sharedPackage} tests changed`);
            }
            if (/package\.json|tsup\.config|vite\.config|src\//.test(file)) {
                addCommand(commands, `pnpm --filter ${sharedPackage} build`, `${sharedPackage} build-impacting files changed`);
            }
            continue;
        }

        const ext = extensionName(file);
        if (ext) {
            addCommand(commands, `pnpm --filter ${ext} check-types`, `${ext} changed`);
            if (/tests?\//.test(file) || /\.(test|spec)\./.test(file)) {
                addCommand(commands, `pnpm --filter ${ext} test`, `${ext} tests changed`);
            }
            if (/src\/web|vite\.config|index\.html|package\.json/.test(file)) {
                addCommand(commands, `pnpm --filter ${ext} build:web`, `${ext} web/build config changed`);
            }
            if (/src\/api|tsup\.config|package\.json/.test(file)) {
                addCommand(commands, `pnpm --filter ${ext} build:api`, `${ext} API/build config changed`);
            }
            if (ext === "echoflow-video" && /tests\/e2e\//.test(file)) {
                notes.add("`echoflow-video` E2E 需要 `BASE_URL`、`ADMIN_AUTH_TOKEN`、`WEB_USER_AUTH_TOKEN` 后再运行 `pnpm --filter echoflow-video test:e2e`。");
            }
            continue;
        }

        if (file === "AGENTS.md" || file === "CLAUDE.md" || file.startsWith("skills/") || file.startsWith(".claude/") || file === ".mcp.json") {
            notes.add("仅协作文档、Claude Code 配置或 skill 变更通常不需要产品构建；请确认 JSON/脚本语法和说明与现有脚本、规范一致。");
        }
    }

    if (touchedDesignWorkflow) {
        notes.add("Design Gallery 变更需确认 `__design` 路由仅在 `import.meta.env.DEV` 下注册，sandbox 页面/fixture/variant 未被生产页面静态 import。");
        notes.add("Design Gallery fixture 必须是 public-shaped，不包含 secretId、Base URL、API Key、rawRequest/rawResponse/rawEvents、provider internals、上游任务 ID 或管理员备注。");
        notes.add("Design Gallery 迁移后需删除落选 variant、未用 fixture、临时 CSS、截图和 TODO；若 build:web 成功，可 grep 产物确认无 `__design` / `design-sandbox` 残留。");
    }

    return { commands, notes };
}

function emitHints(files) {
    const { commands, notes } = buildHints(files);
    if (!commands.size && !notes.size) return;

    const lines = [];
    lines.push("EchoFlow verification hints based on files touched by Claude this turn:");

    if (commands.size) {
        lines.push("\nSuggested commands (choose the smallest relevant set):");
        for (const [command, reasons] of commands.entries()) {
            lines.push(`- ${command}  # ${Array.from(reasons).join("; ")}`);
        }
    }

    if (notes.size) {
        lines.push("\nNotes:");
        for (const note of notes) {
            lines.push(`- ${note}`);
        }
    }

    lines.push("\nAvoid automatic `pnpm format`, `pnpm lint:fix`, full `pnpm build`, install, Docker, or DB writes unless explicitly requested.");

    const message = lines.join("\n");
    process.stdout.write(
        `${JSON.stringify({
            hookSpecificOutput: {
                hookEventName: "Stop",
                additionalContext: message,
            },
        })}\n`,
    );
}

const input = readHookInput();

if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(input.tool_name)) {
    recordTouchedFiles(input);
} else {
    const files = readTouchedFiles(input);
    emitHints(files);
}
