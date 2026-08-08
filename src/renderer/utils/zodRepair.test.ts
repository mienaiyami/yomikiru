import { describe, expect, it } from "vitest";
import { z } from "zod";
import { repairZodInputWithDefaults } from "./zodRepair";

const schema = z.object({
    name: z.string(),
    count: z.number(),
    nested: z.object({ flag: z.boolean() }),
});

const defaults = {
    name: "default",
    count: 0,
    nested: { flag: false },
};

describe("repairZodInputWithDefaults", () => {
    it("returns parsed data when input is already valid", () => {
        const input = { name: "ok", count: 2, nested: { flag: true } };
        const result = repairZodInputWithDefaults(schema, input, () => undefined);
        expect(result).toEqual({ success: true, data: input });
    });

    it("fills missing leaves from defaults", () => {
        const result = repairZodInputWithDefaults(schema, { name: "x" }, (path, ctx) => {
            let cur: unknown = defaults;
            for (const key of path) {
                if (cur == null || typeof cur !== "object") return undefined;
                cur = (cur as Record<string, unknown>)[key as string];
            }
            // Prefer defaults over whatever is already on ctx for the leaf
            void ctx;
            return cur;
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual({ name: "x", count: 0, nested: { flag: false } });
        }
    });

    it("returns failure when defaults cannot satisfy the schema", () => {
        const result = repairZodInputWithDefaults(schema, {}, () => undefined, 2);
        expect(result).toEqual({ success: false });
    });
});
