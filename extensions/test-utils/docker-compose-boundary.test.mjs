import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const EXTENSIONS_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.dirname(EXTENSIONS_DIR);
const DOCKER_COMPOSE_FILE = path.join(REPO_ROOT, "docker-compose.yml");
const AGENTS_FILE = path.join(REPO_ROOT, "AGENTS.md");

test("nodejs service isolates workspace package node_modules inside linux container", async () => {
    const source = await readFile(DOCKER_COMPOSE_FILE, "utf8");

    for (const packageName of [
        "ai-sdk",
        "ai-toolkit",
        "llm-file-parser",
        "extension-sdk",
    ]) {
        assert.match(
            source,
            new RegExp(`- /buildingai/packages/@buildingai/${packageName}/node_modules`),
            `${packageName} node_modules must be an anonymous volume so Windows pnpm links do not leak into Linux containers`,
        );
    }
});

test("agents records Windows pnpm docker node_modules isolation rule", async () => {
    const source = await readFile(AGENTS_FILE, "utf8");

    assert.match(source, /Windows.*pnpm.*Docker/i);
    assert.match(source, /anonymous volume/i);
    assert.match(source, /Junction/i);
});
