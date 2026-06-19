import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";
import { build } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const packageJson = JSON.parse(await readFile(resolve(__dirname, "../package.json"), "utf8"));

await build(
    defineExtensionViteConfig(packageJson, {
        configFile: false,
        root,
        resolve: {
            alias: [
                {
                    find: /^react-router-dom$/,
                    replacement: resolve(
                        __dirname,
                        "../../../node_modules/.pnpm/node_modules/react-router-dom/dist/index.mjs",
                    ),
                },
                {
                    find: /^react-router\/dom$/,
                    replacement: resolve(
                        __dirname,
                        "../../../node_modules/.pnpm/node_modules/react-router/dist/production/dom-export.mjs",
                    ),
                },
                {
                    find: /^react-router$/,
                    replacement: resolve(
                        __dirname,
                        "../../../node_modules/.pnpm/node_modules/react-router/dist/production/index.mjs",
                    ),
                },
                {
                    find: /^radix-ui$/,
                    replacement: resolve(__dirname, "../../../node_modules/.pnpm/node_modules/radix-ui/dist/index.mjs"),
                },
                {
                    find: /^tldraw$/,
                    replacement: resolve(__dirname, "../../../node_modules/.pnpm/node_modules/tldraw/dist-esm/index.mjs"),
                },
                {
                    find: /^tldraw\/tldraw.css$/,
                    replacement: resolve(__dirname, "../../../node_modules/.pnpm/node_modules/tldraw/tldraw.css"),
                },
                {
                    find: /^zustand\/(.+)$/,
                    replacement: resolve(__dirname, "../../../node_modules/.pnpm/node_modules/zustand/esm/$1.mjs"),
                },
                {
                    find: /^zustand$/,
                    replacement: resolve(__dirname, "../../../node_modules/.pnpm/node_modules/zustand/esm/index.mjs"),
                },
                {
                    find: /^@buildingai\/utils\/(.+)$/,
                    replacement: resolve(__dirname, "../../../packages/@buildingai/utils/src/$1.ts"),
                },
                {
                    find: "@buildingai/utils",
                    replacement: resolve(__dirname, "../../../packages/@buildingai/utils/src/index.ts"),
                },
            ],
        },
        build: {
            rollupOptions: {
                input: resolve(root, "index.html"),
            },
        },
        server: {
            open: true,
        },
    }),
);
