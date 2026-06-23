import { readdirSync } from "node:fs";
import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";

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

export default {
    plugins: [react(), tailwindcss()],
    base: `/extension/${packageJson.name}`,
    envDir: "./../../",
    resolve: {
        // The extension root tsconfig references the API tsconfig, which extends
        // workspace-only NestJS settings. Keep the web dev server on explicit
        // aliases so a browser load never depends on backend tsconfig resolution.
        tsconfigPaths: false,
        alias: [
            {
                find: "shadcn/tailwind.css",
                replacement: resolve(resolvePnpmPackage("shadcn"), "dist/tailwind.css"),
            },
            {
                find: "react-router-dom",
                replacement: resolvePnpmPackage("react-router-dom"),
            },
            {
                find: "radix-ui",
                replacement: resolvePnpmPackage("radix-ui"),
            },
            {
                find: "zustand",
                replacement: resolvePnpmPackage("zustand"),
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
    build: {
        outDir: ".output/public",
        sourcemap: false,
        rollupOptions: {
            onwarn(warning: { code?: string; message?: string }, warn: (warning: unknown) => void) {
                if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
                if (warning.code === "COMMONJS_VARIABLE_IN_ESM") return;
                if (
                    warning.message &&
                    warning.message.includes("dynamic import will not move module into another chunk")
                )
                    return;
                if (
                    warning.message &&
                    warning.message.includes("externalized for browser compatibility")
                )
                    return;
                warn(warning);
            },
            output: {
                manualChunks(id: string) {
                    if (id.includes("lucide-react")) {
                        return "lucide";
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        open: true,
    },
};
