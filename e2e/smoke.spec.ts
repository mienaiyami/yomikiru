import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { _electron as electron, expect, test } from "@playwright/test";

const nodeRequire = createRequire(__filename);
const repoRoot = path.resolve(__dirname, "..");
/** Forge Webpack main entry (`package.json` `"main"`). */
const mainEntry = path.join(repoRoot, ".webpack", "main");

/**
 * Launches the packaged Webpack main under Electron with an isolated userData dir.
 */
const launchApp = async () => {
    if (!fs.existsSync(mainEntry)) {
        throw new Error(
            `Missing ${mainEntry}. Build once with \`pnpm package\` (or a Forge start that writes .webpack) before \`pnpm test:e2e\`.`,
        );
    }

    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-e2e-"));
    const electronExecutable = nodeRequire("electron") as unknown as string;

    const app = await electron.launch({
        executablePath: electronExecutable,
        args: [mainEntry, `--user-data-dir=${userDataDir}`],
        cwd: repoRoot,
        env: {
            ...process.env,
            NODE_ENV: "production",
        },
    });

    return { app, userDataDir };
};

test("opens a window with the home container visible", async () => {
    const { app, userDataDir } = await launchApp();
    try {
        const page = await app.firstWindow();
        await page.waitForTimeout(10000);
        await expect(page.locator(".homeContainer")).toBeVisible({ timeout: 60_000 });
    } finally {
        await app.close();
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
});
