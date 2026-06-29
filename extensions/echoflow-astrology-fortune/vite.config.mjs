import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json" with { type: "json" };

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineExtensionViteConfig(packageJson, {
    root: __dirname,
    server: {
        open: true,
    },
});
