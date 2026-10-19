import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import dateUtils from "./date";

describe("dateUtils", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("format returns fallback for empty/invalid dates", () => {
        expect(dateUtils.format(null)).toBe("Invalid date");
        expect(dateUtils.format("not-a-date", { fallback: "n/a" })).toBe("n/a");
    });

    it("format formats a valid local date with presets", () => {
        // local Date(y, m, d) avoids UTC timezone day-shift flakes
        expect(dateUtils.format(new Date(2024, 0, 2), { format: dateUtils.presets.iso })).toBe("2024-01-02");
        expect(dateUtils.format(new Date(2024, 0, 2), { format: dateUtils.presets.short })).toBe("02/01/2024");
    });

    it("relative returns a suffixed distance string", () => {
        const fiveMinAgo = new Date("2024-06-15T11:55:00.000Z");
        expect(dateUtils.relative(fiveMinAgo)).toMatch(/ago/i);
        expect(dateUtils.relative(null, { fallback: "none" })).toBe("none");
    });

    it("relativeTo compares two dates", () => {
        const day = new Date("2024-06-14T12:00:00.000Z");
        const base = new Date("2024-06-15T12:00:00.000Z");
        expect(dateUtils.relativeTo(day, base).length).toBeGreaterThan(0);
        expect(dateUtils.relativeTo("bad", base, { fallback: "bad" })).toBe("bad");
    });
});
