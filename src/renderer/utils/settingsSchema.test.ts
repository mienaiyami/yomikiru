import { describe, expect, it } from "vitest";
import { defaultSettings, settingSchema } from "./settingsSchema";
import { repairZodInputWithDefaults } from "./zodRepair";

describe("settingSchema library keys", () => {
    it("strips unreleased scan keys and dropped Default Location path from settings.json", () => {
        const repaired = repairZodInputWithDefaults(
            settingSchema,
            {
                baseDir: "testdata",
                libraryFolders: [{ path: "testdata" }],
                scanDefaultLocation: true,
                scanDefaultLocationSkipPattern: "x",
            },
            (path) => {
                let cur: unknown = defaultSettings;
                for (const part of path) {
                    if (cur === null || typeof cur !== "object" || !(String(part) in cur)) return undefined;
                    cur = (cur as Record<string, unknown>)[String(part)];
                }
                return cur;
            },
        );
        expect(repaired.success).toBe(true);
        if (!repaired.success) return;
        expect("baseDir" in repaired.data).toBe(false);
        expect("libraryFolders" in repaired.data).toBe(false);
        expect("scanDefaultLocation" in repaired.data).toBe(false);
        expect(repaired.data.librarySettingsExpanded).toBe(true);
        expect(repaired.data.libraryFoldersListExpanded).toBe(true);
    });
});
