import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const claudeAgentsDir = join(rootDir, ".claude/agents");
const codexAgentsDir = join(rootDir, ".codex/agents");

function read(file) {
    return readFileSync(file, "utf8").replaceAll("\r\n", "\n");
}

function parseClaudeAgent(file) {
    const content = read(file);
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) throw new Error("missing YAML frontmatter");

    const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
    const description = match[1].match(/^description:\s*(.+)$/m)?.[1]?.trim();
    if (!name || !description) throw new Error("missing name or description");

    return { name, description, instructions: match[2].trim() };
}

function parseTomlString(value) {
    return JSON.parse(value);
}

function parseCodexAgent(file) {
    const content = read(file);
    const nameMatch = content.match(/^name\s*=\s*("(?:\\.|[^"])*")$/m);
    const descriptionMatch = content.match(/^description\s*=\s*("(?:\\.|[^"])*")$/m);
    const instructionsMatch = content.match(/developer_instructions\s*=\s*"""([\s\S]*?)"""\s*$/);
    if (!nameMatch || !descriptionMatch || !instructionsMatch) {
        throw new Error("missing name, description, or developer_instructions");
    }

    return {
        name: parseTomlString(nameMatch[1]),
        description: parseTomlString(descriptionMatch[1]),
        instructions: instructionsMatch[1].trim(),
    };
}

function agentNames(dir, extension) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
        .filter((file) => file.endsWith(extension))
        .map((file) => basename(file, extension))
        .sort();
}

function renderCodexAgent(agent) {
    if (agent.instructions.includes('"""')) {
        throw new Error(`${agent.name}: instructions contain unsupported TOML triple quotes`);
    }

    return [
        `name = ${JSON.stringify(agent.name)}`,
        `description = ${JSON.stringify(agent.description)}`,
        'developer_instructions = """',
        agent.instructions,
        '"""',
        "",
    ].join("\n");
}

function syncGovernance() {
    for (const name of agentNames(claudeAgentsDir, ".md")) {
        const agent = parseClaudeAgent(join(claudeAgentsDir, `${name}.md`));
        writeFileSync(join(codexAgentsDir, `${name}.toml`), renderCodexAgent(agent));
    }

    for (const name of ["pretool-guard.mjs", "changed-files-verify.mjs"]) {
        copyFileSync(join(rootDir, ".claude/hooks", name), join(rootDir, ".codex/hooks", name));
    }
}

function checkAgents() {
    const names = new Set([
        ...agentNames(claudeAgentsDir, ".md"),
        ...agentNames(codexAgentsDir, ".toml"),
    ]);
    const failures = [];

    for (const name of [...names].sort()) {
        const claudeFile = join(claudeAgentsDir, `${name}.md`);
        const codexFile = join(codexAgentsDir, `${name}.toml`);
        if (!existsSync(claudeFile) || !existsSync(codexFile)) {
            failures.push(`${name}: missing ${!existsSync(claudeFile) ? "Claude" : "Codex"} copy`);
            continue;
        }

        try {
            const claude = parseClaudeAgent(claudeFile);
            const codex = parseCodexAgent(codexFile);
            for (const field of ["name", "description", "instructions"]) {
                if (claude[field] !== codex[field]) failures.push(`${name}: ${field} drift`);
            }
        } catch (error) {
            failures.push(`${name}: ${error.message}`);
        }
    }

    return failures;
}

function checkHooks() {
    const failures = [];
    const hookNames = ["pretool-guard.mjs", "changed-files-verify.mjs"];

    for (const name of hookNames) {
        const claudeFile = join(rootDir, ".claude/hooks", name);
        const codexFile = join(rootDir, ".codex/hooks", name);
        if (!existsSync(claudeFile) || !existsSync(codexFile)) {
            failures.push(`${name}: missing Claude or Codex hook copy`);
        } else if (read(claudeFile) !== read(codexFile)) {
            failures.push(`${name}: Claude/Codex hook drift`);
        }
    }

    const hooksFile = join(rootDir, ".codex/hooks.json");
    try {
        const hooks = JSON.parse(read(hooksFile));
        const serializedHooks = JSON.stringify(hooks);
        if (
            serializedHooks.includes(rootDir) ||
            /(?:[A-Za-z]:[\\/]|\/(?:home|Users)\/[^/]+\/)/.test(serializedHooks)
        ) {
            failures.push(".codex/hooks.json: contains a machine-specific workspace path");
        }
    } catch (error) {
        failures.push(`.codex/hooks.json: invalid JSON (${error.message})`);
    }

    return failures;
}

function checkHookBehavior() {
    const hook = join(rootDir, ".claude/hooks/pretool-guard.mjs");
    const failures = [];

    for (const command of [
        "sudo rm -rf build",
        "echo ok && rm -rf build",
        "git restore AGENTS.md",
        "git -C extensions/example restore README.md",
        "env git restore AGENTS.md",
        "command git restore AGENTS.md",
        "git --no-pager restore AGENTS.md",
        "git -c advice.detachedHead=false restore AGENTS.md",
    ]) {
        const result = spawnSync(process.execPath, [hook], {
            encoding: "utf8",
            input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
        });
        const output = result.stdout ? JSON.parse(result.stdout) : null;
        if (output?.hookSpecificOutput?.permissionDecision !== "deny") {
            failures.push(`pretool-guard.mjs: did not deny ${command}`);
        }
    }

    for (const command of [
        "git status",
        "git diff -- AGENTS.md",
        "printf 'git restore AGENTS.md\\n'",
    ]) {
        const result = spawnSync(process.execPath, [hook], {
            encoding: "utf8",
            input: JSON.stringify({ tool_name: "Bash", tool_input: { command } }),
        });
        const output = result.stdout ? JSON.parse(result.stdout) : null;
        if (output?.hookSpecificOutput?.permissionDecision) {
            failures.push(`pretool-guard.mjs: unexpectedly blocked ${command}`);
        }
    }

    return failures;
}

function checkSkills() {
    const failures = [];
    const script = join(rootDir, "scripts/sync-skills.mjs");

    for (const editor of ["claude"]) {
        const result = spawnSync(process.execPath, [script, "check", "all", editor], {
            encoding: "utf8",
        });
        if (result.status === 0) continue;
        process.stderr.write(result.stdout || result.stderr || "");
        failures.push(`${editor}: skill mirror drift`);
    }

    return failures;
}

function checkEccHarness() {
    const failures = [];
    const requiredStages = [
        "/ecc:plan",
        "/ecc:tdd-workflow",
        "/ecc:code-review",
        "/ecc:verification-loop",
        "/ecc:build-fix",
        "/ecc:update-docs",
    ];
    const agentsPolicy = read(join(rootDir, "AGENTS.md"));
    for (const stage of requiredStages) {
        if (!agentsPolicy.includes(stage)) {
            failures.push(`AGENTS.md: missing ECC lifecycle stage ${stage}`);
        }
    }

    const claudeEntryPoint = read(join(rootDir, "CLAUDE.md"));
    if (!claudeEntryPoint.includes("use it as the default development harness")) {
        failures.push("CLAUDE.md: missing default ECC lifecycle routing");
    }

    try {
        const settings = JSON.parse(read(join(rootDir, ".claude/settings.json")));
        if (settings.env?.ECC_HOOK_PROFILE !== "strict") {
            failures.push(".claude/settings.json: ECC_HOOK_PROFILE must be strict");
        }
    } catch (error) {
        failures.push(`.claude/settings.json: invalid JSON (${error.message})`);
    }

    return failures;
}

if (process.argv[2] === "sync") {
    syncGovernance();
}

const failures = [
    ...checkAgents(),
    ...checkHooks(),
    ...checkHookBehavior(),
    ...checkSkills(),
    ...checkEccHarness(),
];
if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
} else {
    console.log(
        process.argv[2] === "sync"
            ? "Agent governance synced and checked"
            : "Agent governance check passed",
    );
}
