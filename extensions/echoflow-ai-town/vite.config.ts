import { resolve } from "node:path";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json";

export default defineExtensionViteConfig(packageJson, {
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
