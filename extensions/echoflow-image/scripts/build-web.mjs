import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build, loadConfigFromFile, mergeConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const loadedConfig = await loadConfigFromFile(
    { command: "build", mode: "production" },
    resolve(root, "vite.config.ts"),
    root,
);

if (!loadedConfig) {
    throw new Error("Cannot load echoflow-image Vite config");
}

await build(
    mergeConfig(loadedConfig.config, {
        configFile: false,
        root,
        build: {
            rollupOptions: {
                input: resolve(root, "index.html"),
            },
        },
    }),
);
