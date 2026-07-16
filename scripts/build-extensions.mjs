#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const registryPath = path.join(rootDir, "extensions", "extensions.json");

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, "utf8"));
}

function getLocalExtensionIdentifiers(registry) {
    const entries = [
        ...Object.values(registry.applications ?? {}),
        ...Object.values(registry.functionals ?? {}),
    ];

    return Array.from(
        new Set(
            entries
                .filter((entry) => entry?.isLocal !== false)
                .map((entry) => entry?.manifest?.identifier)
                .filter((identifier) => typeof identifier === "string" && identifier.length > 0),
        ),
    );
}

function runExtensionBuilds(identifiers) {
    const pnpmCommand = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
    const args = [
        "exec",
        "turbo",
        "run",
        "build:publish",
        "--concurrency=1",
        ...identifiers.flatMap((identifier) => ["--filter", identifier]),
    ];

    return new Promise((resolve, reject) => {
        const child = spawn(pnpmCommand, args, {
            cwd: rootDir,
            stdio: "inherit",
            env: {
                ...process.env,
                NODE_OPTIONS: process.env.NODE_OPTIONS || "--max-old-space-size=3072",
            },
        });

        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`Extension build:publish failed with exit code ${code}`));
        });
    });
}

function getExtensionPackage(identifier) {
    const extensionDir = path.join(rootDir, "extensions", identifier);
    const packageJsonPath = path.join(extensionDir, "package.json");

    if (!existsSync(packageJsonPath)) {
        throw new Error(`${identifier} is registered but ${packageJsonPath} does not exist`);
    }

    const packageJson = readJson(packageJsonPath);
    if (packageJson.name !== identifier) {
        throw new Error(
            `${identifier} registry identifier does not match package name ${packageJson.name ?? "<missing>"}`,
        );
    }
    if (!packageJson.scripts?.["build:publish"]) {
        throw new Error(`${identifier} does not define a build:publish script`);
    }

    return extensionDir;
}

function validateExtensionOutputs(identifier) {
    const extensionDir = path.join(rootDir, "extensions", identifier);

    const requiredOutputs = [
        path.join(extensionDir, "build", "index.js"),
        path.join(extensionDir, ".output", "public", "index.html"),
    ];
    const missingOutputs = requiredOutputs.filter((filePath) => !existsSync(filePath));

    if (missingOutputs.length > 0) {
        throw new Error(
            `${identifier} build completed without required outputs:\n${missingOutputs.join("\n")}`,
        );
    }
}

async function main() {
    if (!existsSync(registryPath)) {
        throw new Error(`Extension registry not found: ${registryPath}`);
    }

    const identifiers = getLocalExtensionIdentifiers(readJson(registryPath));
    if (identifiers.length === 0) {
        console.log("No local extensions registered; skipping extension builds.");
        return;
    }

    console.log(`Building ${identifiers.length} local extension(s) sequentially...`);

    for (const identifier of identifiers) {
        getExtensionPackage(identifier);
        console.log(`- ${identifier}`);
    }

    await runExtensionBuilds(identifiers);

    for (const identifier of identifiers) {
        validateExtensionOutputs(identifier);
    }

    console.log(`\nBuilt and validated ${identifiers.length} local extension(s).`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.stack || error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
