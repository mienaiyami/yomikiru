import { defineConfig } from "@playwright/test";

/**
 * Electron smoke lane (Playwright `_electron`).
 * Requires a built main entry at `.webpack/main` (see `docs/testing.md`).
 */
export default defineConfig({
    testDir: "e2e",
    timeout: 120_000,
    workers: 1,
    fullyParallel: false,
    retries: 0,
    reporter: [["list"]],
    outputDir: "test-results",
});
