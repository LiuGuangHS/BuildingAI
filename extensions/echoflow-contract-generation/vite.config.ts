import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json");
const __dirname = dirname(fileURLToPath(import.meta.url));
export default defineExtensionViteConfig(packageJson, {
    root: __dirname,
    build: {
        outDir: ".output/public",
        sourcemap: false,
        rollupOptions: {
            input: "index.html",
            onwarn(warning, warn) {
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
        ],
    },
    server: {
        open: true,
    },
});
