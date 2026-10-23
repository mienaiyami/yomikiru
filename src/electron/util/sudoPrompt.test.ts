import fs from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);

/**
 * Guards the elevated-command package against util.isObject.
 * The Electron Node runtime does not provide that helper. This test host may
 * still have it, so calling exec alone would not fail on the old package.
 */
describe("elevated command prompt", () => {
    it("validates options without util.isObject", async () => {
        const entryPath = require.resolve("@vscode/sudo-prompt");
        const source = fs.readFileSync(entryPath, "utf8");
        expect(source).not.toContain("util.isObject");
        expect(source).not.toContain("util.isFunction");

        const { exec } = await import("@vscode/sudo-prompt");
        expect(() => exec("echo hello", "nope" as never)).toThrow(/Expected options or callback/);
    });
});
