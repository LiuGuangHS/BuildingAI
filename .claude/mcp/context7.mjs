#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = ["-y", "@upstash/context7-mcp"];

if (process.env.CONTEXT7_API_KEY) {
    args.push("--api-key", process.env.CONTEXT7_API_KEY);
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
