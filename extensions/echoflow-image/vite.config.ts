import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json";

const repoRoot = resolve(__dirname, "../..");

function resolvePnpmPackage(packageName: string) {
    const pnpmStore = resolve(repoRoot, "node_modules/.pnpm");
    const packageFolder = packageName.replace("/", "+");
    const candidates = readdirSync(pnpmStore)
        .filter((name) => name.startsWith(`${packageFolder}@`))
        .sort()
        .reverse();

    if (!candidates[0]) {
        throw new Error(`Cannot resolve ${packageName} from ${pnpmStore}`);
    }

    return resolve(pnpmStore, candidates[0], "node_modules", packageName);
}

export default defineExtensionViteConfig(packageJson, {
    resolve: {
        tsconfigPaths: false,
        alias: [
            {
                find: /^react-router-dom$/,
                replacement: resolve(resolvePnpmPackage("react-router-dom"), "dist/index.mjs"),
            },
            {
                find: /^react-router\/dom$/,
                replacement: resolve(resolvePnpmPackage("react-router"), "dist/production/dom-export.mjs"),
            },
            {
                find: /^react-router$/,
                replacement: resolve(resolvePnpmPackage("react-router"), "dist/production/index.mjs"),
            },
            {
                find: /^radix-ui$/,
                replacement: resolve(resolvePnpmPackage("radix-ui"), "dist/index.mjs"),
            },
            {
                find: /^tldraw$/,
                replacement: resolve(resolvePnpmPackage("tldraw"), "dist-esm/index.mjs"),
            },
            {
                find: /^tldraw\/tldraw.css$/,
                replacement: resolve(resolvePnpmPackage("tldraw"), "tldraw.css"),
            },
            {
                find: /^zustand\/(.+)$/,
                replacement: `${resolve(resolvePnpmPackage("zustand"), "esm")}/$1.mjs`,
            },
            {
                find: /^zustand$/,
                replacement: resolve(resolvePnpmPackage("zustand"), "esm/index.mjs"),
            },
            {
                find: /^@buildingai\/utils\/(.+)$/,
                replacement: resolve(__dirname, "../../packages/@buildingai/utils/src/$1.ts"),
            },
            {
                find: "@buildingai/utils",
                replacement: resolve(__dirname, "../../packages/@buildingai/utils/src/index.ts"),
            },
        ],
    },
    server: {
        open: true,
    },
});
