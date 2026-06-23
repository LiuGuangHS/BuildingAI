import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const EXTENSIONS_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = path.dirname(EXTENSIONS_DIR);
const AGENTS_FILE = path.join(REPO_ROOT, "AGENTS.md");
const GITIGNORE_FILE = path.join(REPO_ROOT, ".gitignore");

async function getEchoFlowReadmes() {
    const entries = await readdir(EXTENSIONS_DIR, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith("echoflow-"))
        .map((entry) => ({
            identifier: entry.name,
            readmePath: path.join(EXTENSIONS_DIR, entry.name, "README.md"),
        }))
        .sort((a, b) => a.identifier.localeCompare(b.identifier));
}

test("all EchoFlow plugin README files follow the long-term governance contract", async () => {
    const readmes = await getEchoFlowReadmes();

    assert.deepEqual(
        readmes.map((readme) => readme.identifier),
        [
            "echoflow-ai-town",
            "echoflow-astrology-fortune",
            "echoflow-contract-generation",
            "echoflow-image",
            "echoflow-video",
        ],
    );

    for (const { identifier, readmePath } of readmes) {
        const source = await readFile(readmePath, "utf8");

        assert.match(source, /^# /m, `${identifier} README should have a title`);
        assert.match(source, /文档维护规则/, `${identifier} README should declare document governance`);
        assert.match(source, /AGENTS\.md/, `${identifier} README should point shared rules to AGENTS.md`);
        assert.match(source, /不长期维护第二套插件规范/, `${identifier} README should reject parallel long-term docs`);

        for (const heading of [
            "## 定位",
            "## 当前能力",
            "## 入口与页面",
            "## API 与后端模块",
            "## 主系统复用边界",
            "## 开发与验证",
            "## 已知风险",
        ]) {
            assert.match(source, new RegExp(`^${heading}$`, "m"), `${identifier} README missing ${heading}`);
        }

        assert.match(source, /## (后续完整开发任务|下一步)/, `${identifier} README should keep next work in README`);
        assert.match(source, /\|[^\n]*(范围\/文件|范围|文件)[^\n]*验收[^\n]*\|/, `${identifier} README next work should name scope or files and acceptance`);
        assert.match(source, /\b(pending|partial|reserved|阻塞条件|验证命令和证据|真实.*smoke)\b/, `${identifier} README should make remaining gaps explicit`);
    }
});

test("cross-plugin test utilities are documented and tracked", async () => {
    const [agentsSource, gitignoreSource] = await Promise.all([
        readFile(AGENTS_FILE, "utf8"),
        readFile(GITIGNORE_FILE, "utf8"),
    ]);

    assert.match(agentsSource, /extensions\/test-utils\//);
    assert.match(agentsSource, /可跟踪/);
    assert.match(agentsSource, /不能放业务运行时代码/);
    assert.match(agentsSource, /不能反向依赖/);
    assert.match(gitignoreSource, /^!extensions\/test-utils$/m);
    assert.match(gitignoreSource, /^!extensions\/test-utils\/\*\*$/m);
});
