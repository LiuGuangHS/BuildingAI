import type { Options } from "tsup";

const config: Options = {
    entry: [
        "src/api/**/*.ts",
        "!src/api/**/*.spec.ts",
        "!src/api/**/*.d.ts",
        "!src/api/test-utils/**",
    ],
    outDir: "build",
    format: ["cjs"],
    dts: false,
    bundle: false,
    sourcemap: process.env.NODE_ENV === "development",
    clean: true,
    splitting: false,
    treeshake: true,
    target: "es2023",
    tsconfig: "tsconfig.api.json",
    skipNodeModulesBundle: false,
};

export default config;
