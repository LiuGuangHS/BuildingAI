import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDependency(specifier: string, fallbackPath: string) {
    try {
        return require.resolve(specifier);
    } catch {
        return resolve(__dirname, fallbackPath);
    }
}

function toAliasArray(alias: NonNullable<UserConfig["resolve"]>["alias"] = []) {
    if (Array.isArray(alias)) return alias;
    return Object.entries(alias).map(([find, replacement]) => ({ find, replacement }));
}

const extensionAliases = [
    {
        find: /^react-router-dom$/,
        replacement: resolveDependency(
            "react-router-dom",
            "../../../../../../node_modules/.pnpm/node_modules/react-router-dom/dist/index.mjs",
        ),
    },
    {
        find: /^react-router\/dom$/,
        replacement: resolveDependency(
            "react-router/dom",
            "../../../../../../node_modules/.pnpm/node_modules/react-router/dist/production/dom-export.mjs",
        ),
    },
    {
        find: /^react-router$/,
        replacement: resolveDependency(
            "react-router",
            "../../../../../../node_modules/.pnpm/node_modules/react-router/dist/production/index.mjs",
        ),
    },
    {
        find: /^radix-ui$/,
        replacement: resolveDependency(
            "radix-ui",
            "../../../../../../node_modules/.pnpm/node_modules/radix-ui/dist/index.mjs",
        ),
    },
    {
        find: /^lucide-react$/,
        replacement: resolveDependency(
            "lucide-react/dist/esm/lucide-react.js",
            "../../../../../../node_modules/.pnpm/node_modules/lucide-react/dist/esm/lucide-react.js",
        ),
    },
    {
        find: /^zustand\/(.+)$/,
        replacement: resolve(__dirname, "../../../../../../node_modules/.pnpm/node_modules/zustand/esm/$1.mjs"),
    },
    {
        find: /^zustand$/,
        replacement: resolve(__dirname, "../../../../../../node_modules/.pnpm/node_modules/zustand/esm/index.mjs"),
    },
    {
        find: /^@buildingai\/utils\/(.+)$/,
        replacement: resolve(__dirname, "../../../../utils/src/$1.ts"),
    },
    {
        find: "@buildingai/utils",
        replacement: resolve(__dirname, "../../../../utils/src/index.ts"),
    },
];

// https://vite.dev/config/
export const defineExtensionViteConfig = (packageJson: { name: string }, config?: UserConfig) => {
    const plugins = [react(), tailwindcss()];
    const babelModule = (() => {
        try {
            require.resolve("babel-plugin-react-compiler");
            return require("@rolldown/plugin-babel");
        } catch {
            return null;
        }
    })();

    if (babelModule) {
        const babel = babelModule.default ?? babelModule;
        plugins.push(babel({ presets: [reactCompilerPreset()] }));
    }

    return defineConfig({
        plugins,
        base: `/extension/${packageJson.name}`,
        envDir: "./../../",
        build: {
            outDir: ".output/public",
            sourcemap: false,
            chunkSizeWarningLimit: 2000,
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
                output: {
                    manualChunks(id) {
                        if (id.includes("lucide-react")) {
                            return "lucide";
                        }
                    },
                },
            },
        },
        ...config,
        resolve: {
            ...config?.resolve,
            tsconfigPaths: config?.resolve?.tsconfigPaths ?? true,
            alias: [...extensionAliases, ...toAliasArray(config?.resolve?.alias)],
        },
    });
};
