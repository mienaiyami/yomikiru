import { describe, expect, it } from "vitest";
import { defaultSettings, settingSchema } from "./settingsSchema";
import { repairZodInputWithDefaults } from "./zodRepair";

describe("settingSchema library scan keys", () => {
    it("repairs old JSON that has no libraryFolders or scanDefaultLocation", () => {
        const repaired = repairZodInputWithDefaults(settingSchema, { baseDir: "testdata" }, (path) => {
            let cur: unknown = defaultSettings;
            for (const part of path) {
                if (cur === null || typeof cur !== "object" || !(String(part) in cur)) return undefined;
                cur = (cur as Record<string, unknown>)[String(part)];
            }
            return cur;
        });
        expect(repaired.success).toBe(true);
        if (!repaired.success) return;
        expect(repaired.data.libraryFolders).toEqual([]);
        expect(repaired.data.scanDefaultLocation).toBe(false);
        expect(repaired.data.scanDefaultLocationSkipPattern).toBe("");
        expect(repaired.data.scanDefaultLocationTagIds).toEqual([]);
        expect(repaired.data.scanDefaultLocationMaxDepth).toBe(2);
        expect(repaired.data.scanDefaultLocationIntervalMinutes).toBe(0);
        expect(repaired.data.librarySettingsExpanded).toBe(true);
        expect(repaired.data.libraryFoldersListExpanded).toBe(true);
    });

    it("fills missing library folder maxDepth with the default walk depth", () => {
        const repaired = repairZodInputWithDefaults(
            settingSchema,
            { baseDir: "testdata", libraryFolders: [{ path: "testdata" }] },
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
        expect(repaired.data.libraryFolders[0]?.maxDepth).toBe(2);
        expect(repaired.data.libraryFolders[0]?.watch).toBe(false);
        expect(repaired.data.libraryFolders[0]?.skipPattern).toBe("");
        expect(repaired.data.libraryFolders[0]?.tagIds).toEqual([]);
    });

    it("truncates fractional scan interval minutes from settings.json", () => {
        const extra = "testdata";
        const parsed = settingSchema.parse({
            ...defaultSettings,
            baseDir: extra,
            scanDefaultLocationIntervalMinutes: 90.9,
            libraryFolders: [{ path: extra, scanIntervalMinutes: 30.5 }],
        });
        expect(parsed.scanDefaultLocationIntervalMinutes).toBe(90);
        expect(parsed.libraryFolders[0]?.scanIntervalMinutes).toBe(30);
    });
});
