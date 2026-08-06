#!/usr/bin/env node
import { readFileSync } from "node:fs";
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

    return absolutePath.split(path.sep).join("/");
}

function pathSegments(filePath) {
    return filePath.split("/").filter(Boolean);
}

function hasSegment(filePath, names) {
    const nameSet = new Set(names);
    return pathSegments(filePath).some((segment) => nameSet.has(segment));
}

function isEnvFile(filePath) {
    if (filePath === ".env.example" || filePath.endsWith("/.env.example")) return false;
    const fileName = path.posix.basename(filePath);
    return fileName === ".env" || fileName.startsWith(".env.");
}

function isExtensionManifest(filePath) {
    return /^extensions\/[^/]+\/manifest\.json$/.test(filePath) || filePath === "extensions/extensions.json";
}

function isGeneratedOrRuntimePath(filePath) {
    if (
        hasSegment(filePath, [
            "node_modules",
            ".turbo",
            "dist",
            "build",
            ".output",
            ".nuxt",
            ".temp",
            "logs",
        ])
    ) {
        return true;
    }

    return (
        filePath.startsWith("docker/data/") ||
        filePath.startsWith("storage/uploads/") ||
        filePath.startsWith("public/web/assets/") ||
        filePath.startsWith("packages/client/src-tauri/gen/") ||
        filePath.startsWith("packages/client/src-tauri/target/")
    );
}

function isCautiousConfigPath(filePath) {
    return (
        filePath === ".claude/settings.local.json" ||
        filePath === "pnpm-lock.yaml" ||
        filePath === "pnpm-workspace.yaml" ||
        filePath === ".npmrc" ||
        filePath === ".nvmrc" ||
        filePath === "turbo.json" ||
        filePath === "package.json" ||
        filePath === "docker-compose.yml" ||
        filePath.endsWith("/package.json")
    );
}

function emitPermission(permissionDecision, reason) {
    const output = {
        systemMessage: reason,
        hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision,
            permissionDecisionReason: reason,
        },
    };

    if (permissionDecision === "deny") {
        output.continue = false;
        output.stopReason = reason;
    }

    process.stdout.write(`${JSON.stringify(output)}\n`);
}

function deny(reason) {
    emitPermission("deny", `EchoFlow guard: ${reason}`);
}

function ask(reason) {
    emitPermission("ask", `EchoFlow guard: ${reason}`);
}

function shouldDenyPath(filePath) {
    if (isEnvFile(filePath)) {
        return "blocked edit to environment file. Put secrets/config in local files outside shared commits and explain the need before changing env templates.";
    }

    if (isGeneratedOrRuntimePath(filePath)) {
        return `blocked edit to generated/runtime path \`${filePath}\`. Rebuild or regenerate it instead of hand-editing artifacts.`;
    }

    return null;
}

function shouldAskPath(filePath) {
    if (isExtensionManifest(filePath)) {
        return `extension metadata path \`${filePath}\` requires confirmation. Explain identifier/name/version/engine/extensions.json consistency before editing.`;
    }

    if (isCautiousConfigPath(filePath)) {
        return `cautious workspace/config path \`${filePath}\` requires confirmation. Explain impact on dependencies, workspace, local permissions, Docker, or package scripts before editing.`;
    }

    return null;
}

function inspectFilePath(filePath) {
    const normalizedPath = normalizePath(filePath);
    if (!normalizedPath) return false;

    const denyReason = shouldDenyPath(normalizedPath);
    if (denyReason) {
        deny(denyReason);
        return true;
    }

    const askReason = shouldAskPath(normalizedPath);
    if (askReason) {
        ask(askReason);
        return true;
    }

    return false;
}

function commandHasHighRiskTarget(command) {
    return [
        ".env",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        ".npmrc",
        ".nvmrc",
        "turbo.json",
        "docker-compose.yml",
        ".claude/settings.local.json",
        "docker/data",
        "storage/uploads",
        "node_modules",
        ".turbo",
        "dist",
        "build",
        ".output",
        ".nuxt",
        "public/web/assets",
        "src-tauri/gen",
        "src-tauri/target",
        "extensions/extensions.json",
        "manifest.json",
    ].some((needle) => command.includes(needle));
}

function shellCommandSegments(command) {
    return command
        .split(/(?:&&|\|\||;|\n)/)
        .map((segment) => segment.trim().replace(/^(?:sudo\s+)+/, ""));
}

function shellRmSegments(command) {
    return shellCommandSegments(command).filter((segment) => /^rm\s/.test(segment));
}

function isGitRestoreCommand(segment) {
    const tokens = segment.split(/\s+/);
    let index = 0;

    while (tokens[index] === "env" || tokens[index] === "command") {
        index++;
        while (tokens[index]?.startsWith("-") || tokens[index]?.includes("=")) index++;
    }

    if (tokens[index] !== "git") return false;
    index++;

    while (tokens[index]) {
        const token = tokens[index];
        if (token === "restore") return true;
        if (["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env"].includes(token)) {
            index += 2;
            continue;
        }
        if (token.startsWith("-")) {
            index++;
            continue;
        }
        return false;
    }

    return false;
}

function inspectBashCommand(command) {
    if (!command || typeof command !== "string") return false;
    const trimmed = command.trim();

    if (/\bgit\s+reset\b/.test(trimmed)) {
        deny("blocked `git reset`. Do not discard repository state without a one-off user request.");
        return true;
    }

    if (/\bgit\s+checkout\s+--\b/.test(trimmed)) {
        deny("blocked `git checkout --`. Do not revert files without a one-off user request.");
        return true;
    }

    if (shellCommandSegments(trimmed).some(isGitRestoreCommand)) {
        deny("blocked `git restore`. Do not discard repository state without a one-off user request.");
        return true;
    }

    const rmSegments = shellRmSegments(trimmed);
    if (rmSegments.some((segment) => /(^|\s)-[A-Za-z]*r[A-Za-z]*f?\b/.test(segment) || commandHasHighRiskTarget(segment))) {
        deny("blocked destructive `rm` touching recursive or high-risk targets. Explain exactly what will be removed and ask the user first.");
        return true;
    }

    if (/\bpnpm\s+(install|i|add|remove|rm)\b/.test(trimmed)) {
        ask("dependency/install command requires confirmation because it can change node_modules, lockfiles, and workspace resolution.");
        return true;
    }

    if (/\bpnpm\b.*\b(format|lint:fix)\b/.test(trimmed)) {
        ask("format/lint:fix command requires confirmation because it can create broad unrelated diffs.");
        return true;
    }

    if (/\bdocker\s+compose\s+(up|down|restart|rm|kill)\b/.test(trimmed) || /\bpnpm\s+docker:(up|down)\b/.test(trimmed)) {
        ask("Docker lifecycle command requires confirmation because it changes local runtime services.");
        return true;
    }

    if (/^(mv|cp)\s/.test(trimmed) && commandHasHighRiskTarget(trimmed)) {
        ask("file move/copy touches high-risk or generated paths. Explain source/target and why regeneration is not enough before continuing.");
        return true;
    }

    if (rmSegments.length > 0) {
        ask("file removal requires confirmation. Explain why deleting this path is safe and whether it was created in this task.");
        return true;
    }

    return false;
}

const input = readHookInput();
const toolName = input.tool_name || "";
const toolInput = input.tool_input || {};

if (toolName === "Bash") {
    inspectBashCommand(toolInput.command);
} else if (["Write", "Edit", "MultiEdit", "NotebookEdit"].includes(toolName)) {
    const candidatePaths = [
        toolInput.file_path,
        toolInput.path,
        toolInput.notebook_path,
        ...(Array.isArray(toolInput.files) ? toolInput.files : []),
    ];

    for (const candidatePath of candidatePaths) {
        if (inspectFilePath(candidatePath)) break;
    }
}
