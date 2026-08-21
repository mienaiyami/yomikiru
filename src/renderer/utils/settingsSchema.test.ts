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
        expect(repaired.data.scanDefaultLocationIntervalHours).toBe(0);
    });
});
