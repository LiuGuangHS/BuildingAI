import { defineExtensionViteConfig } from "@buildingai/web-core/vite/extension";

import packageJson from "./package.json";

export default defineExtensionViteConfig(packageJson, {
    resolve: {
        tsconfigPaths: false,
    },
    server: {
        open: true,
    },
});
