#!/usr/bin/env node
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = ["-y", "@playwright/mcp@latest"];
const cdpEndpoint = process.env.PLAYWRIGHT_CDP_ENDPOINT || process.env.PLAYWRIGHT_MCP_CDP_ENDPOINT;

if (process.env.PLAYWRIGHT_MCP_CONFIG) {
    args.push("--config", process.env.PLAYWRIGHT_MCP_CONFIG);
} else if (cdpEndpoint) {
    const configPath = path.join(tmpdir(), `buildingai-playwright-mcp-${process.pid}.json`);
    writeFileSync(
        configPath,
        JSON.stringify(
            {
                browser: {
                    cdpEndpoint,
                    cdpTimeout: Number(process.env.PLAYWRIGHT_CDP_TIMEOUT || 10000),
                },
            },
            null,
            2,
        ),
    );
    args.push("--config", configPath);
} else if (process.env.PLAYWRIGHT_MCP_BROWSER) {
    args.push(`--browser=${process.env.PLAYWRIGHT_MCP_BROWSER}`);
}

if (process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH) {
    args.push("--executable-path", process.env.PLAYWRIGHT_MCP_EXECUTABLE_PATH);
}

const child = spawn("npx", args, {
    stdio: "inherit",
    env: process.env,
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 1);
});
