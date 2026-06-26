import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineExtensionViteConfig(packageJson, {
    build: {
        outDir: ".output/public",
        sourcemap: false,
        rollupOptions: {
            onwarn(warning, warn) {
                if (warning.code === "MODULE_LEVEL_DIRECTIVE") return;
                if (warning.code === "COMMONJS_VARIABLE_IN_ESM") return;
                if (
                    warning.message &&
                    warning.message.includes(
                        "dynamic import will not move module into another chunk",
                    )
                )
                    return;
                if (
                    warning.message &&
                    warning.message.includes("externalized for browser compatibility")
                )
                    return;
                warn(warning);
            },
        },
    },
    resolve: {
        alias: [
            {
                find: /^react-router-dom$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/react-router-dom/dist/index.mjs",
                ),
            },
            {
                find: /^react-router\/dom$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/react-router/dist/production/dom-export.mjs",
                ),
            },
            {
                find: /^react-router$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/react-router/dist/production/index.mjs",
                ),
            },
            {
                find: /^radix-ui$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/radix-ui/dist/index.mjs",
                ),
            },
            {
                find: /^zustand\/(.+)$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/zustand/esm/$1.mjs",
                ),
            },
            {
                find: /^zustand$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/zustand/esm/index.mjs",
                ),
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
