import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function resolveDependency(specifier, fallbackPath) {
    try {
        return require.resolve(specifier);
    } catch {
        return resolve(__dirname, fallbackPath);
    }
}

function townManualChunks(id) {
    if (id.includes("lucide-react")) return "icons";
    if (id.includes("/src/web/pages/console/") || id.includes("\\src\\web\\pages\\console\\")) return "console-pages";
    if (id.includes("@radix-ui") || id.includes("radix-ui")) return "ui-radix";
    if (id.includes("@buildingai/web/ui/src/components/ui/")) return "ui-components";
    if (id.includes("framer-motion")) return "motion";
    return undefined;
}

export default defineExtensionViteConfig(packageJson, {
    build: {
        rollupOptions: {
            output: {
                manualChunks: townManualChunks,
            },
        },
    },
    resolve: {
        alias: [
            {
                find: /^lucide-react$/,
                replacement: resolveDependency(
                    "lucide-react/dist/esm/lucide-react.js",
                    "../../node_modules/.pnpm/node_modules/lucide-react/dist/esm/lucide-react.js",
                ),
            },
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
                find: /^framer-motion$/,
                replacement: resolve(
                    __dirname,
                    "../../node_modules/.pnpm/node_modules/framer-motion/dist/es/index.mjs",
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
