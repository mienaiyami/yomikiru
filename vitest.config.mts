import path from "node:path";
import ts from "typescript";
import { defineConfig } from "vitest/config";

/** Repo root; Vitest is always invoked with cwd at the project root. */
const rootDir = process.cwd();

type TsconfigPaths = Record<string, string[]>;

/**
 * Builds Vite `resolve.alias` from {@link tsconfig.json} `compilerOptions.paths`
 * so Vitest stays aligned with Webpack's `TsconfigPathsPlugin` (single source of truth).
 */
const aliasFromTsconfig = (): Record<string, string> => {
    const configPath = ts.findConfigFile(rootDir, ts.sys.fileExists, "tsconfig.json");
    if (!configPath) {
        throw new Error("vitest: tsconfig.json not found");
    }
    const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile);
    if (error) {
        throw new Error(`vitest: failed to read tsconfig.json: ${error.messageText}`);
    }
    const baseUrl = path.resolve(rootDir, (config.compilerOptions?.baseUrl as string | undefined) ?? ".");
    const paths = (config.compilerOptions?.paths ?? {}) as TsconfigPaths;
    const alias: Record<string, string> = {};
    for (const [pattern, targets] of Object.entries(paths)) {
        const target = targets[0];
        if (!target) continue;
        const key = pattern.replace(/\/\*$/, "");
        alias[key] = path.resolve(baseUrl, target.replace(/\/\*$/, ""));
    }
    return alias;
};

const alias = aliasFromTsconfig();

/**
 * Vitest sits beside Electron Forge/Webpack - it does not replace the app bundler.
 * Two projects: `unit` (jsdom + preload fake) and `db` (node + better-sqlite3).
 *
 * NODE_ENV is set via `cross-env` in package.json scripts.
 */
export default defineConfig({
    resolve: { alias },
    test: {
        projects: [
            {
                resolve: { alias },
                test: {
                    name: "unit",
                    environment: "jsdom",
                    include: ["src/renderer/**/*.test.{ts,tsx}", "src/common/**/*.test.ts"],
                    setupFiles: ["src/test/setup.ts"],
                },
            },
            {
                resolve: { alias },
                test: {
                    name: "db",
                    environment: "node",
                    include: ["src/electron/db/**/*.test.ts", "src/electron/util/**/*.test.ts"],
                    setupFiles: ["src/test/setupMainLibraryIo.ts"],
                },
            },
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json-summary", "html"],
            include: ["src/common/**", "src/renderer/**", "src/electron/db/**", "src/electron/util/**"],
            exclude: [
                "**/*.d.ts",
                "**/*.test.*",
                "src/renderer/index.tsx",
                "src/electron/main.ts",
                "src/electron/preload.ts",
                "src/renderer/styles/**",
                "src/test/**",
            ],
            thresholds: {
                lines: 13,
                functions: 42,
                branches: 68,
                statements: 13,
            },
        },
    },
});
