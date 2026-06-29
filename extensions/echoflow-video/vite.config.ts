import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

const require = createRequire(import.meta.url);
const packageJson = require("./package.json");
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineExtensionViteConfig(packageJson, {
    root: __dirname,
    resolve: {
        // Keep the web dev server away from backend-only tsconfig references.
        tsconfigPaths: false,
    },
    server: {
        open: true,
    },
});
