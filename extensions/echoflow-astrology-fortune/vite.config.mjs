import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json");
const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDependency(specifier, fallbackPath) {
    try {
        return require.resolve(specifier);
    } catch {
        return resolve(__dirname, fallbackPath);
    }
}

export default defineExtensionViteConfig(packageJson, {
    root: __dirname,
    resolve: {
        alias: [
            {
                find: /^react-router-dom$/,
                replacement: resolveDependency(
                    "react-router-dom",
                    "../../node_modules/.pnpm/node_modules/react-router-dom/dist/index.mjs",
                ),
            },
            {
                find: /^react-router\/dom$/,
                replacement: resolveDependency(
                    "react-router/dom",
                    "../../node_modules/.pnpm/node_modules/react-router/dist/production/dom-export.mjs",
                ),
            },
            {
                find: /^react-router$/,
                replacement: resolveDependency(
                    "react-router",
                    "../../node_modules/.pnpm/node_modules/react-router/dist/production/index.mjs",
                ),
            },
            {
                find: /^radix-ui$/,
                replacement: resolveDependency(
                    "radix-ui",
                    "../../node_modules/.pnpm/node_modules/radix-ui/dist/index.mjs",
                ),
            },
            {
                find: /^lucide-react$/,
                replacement: resolveDependency(
                    "lucide-react/dist/esm/lucide-react.js",
                    "../../node_modules/.pnpm/node_modules/lucide-react/dist/esm/lucide-react.js",
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
