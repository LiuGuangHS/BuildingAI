import { createRequire } from "node:module";
import tailwindcss from "@tailwindcss/vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig, type UserConfig } from "vite";

const require = createRequire(import.meta.url);

// https://vite.dev/config/
export const defineExtensionViteConfig = (packageJson: { name: string }, config?: UserConfig) => {
    const plugins = [react(), tailwindcss()];
    const babelModule = (() => {
        try {
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
        resolve: {
            tsconfigPaths: true,
        },
        base: `/extension/${packageJson.name}`,
        envDir: "./../../",
        build: {
            outDir: ".output/public",
            sourcemap: false,
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
    });
};
