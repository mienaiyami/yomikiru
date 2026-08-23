import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultMainSettings, parseMainSettings } from "./mainSettings";

describe("parseMainSettings", () => {
    it("fills fallback tempPath when raw omits it", () => {
        const temp = path.join("os", "temp");
        expect(parseMainSettings({}, temp).tempPath).toBe(temp);
        expect(defaultMainSettings(temp).tempPath).toBe(temp);
    });

    it("keeps a stored tempPath over the fallback", () => {
        const custom = path.join("user", "tmp");
        expect(parseMainSettings({ tempPath: custom }, path.join("os", "temp")).tempPath).toBe(custom);
    });

    it("replaces a blank stored tempPath with the fallback", () => {
        const temp = path.join("os", "temp");
        expect(parseMainSettings({ tempPath: "  " }, temp).tempPath).toBe(temp);
    });

    it("heals an empty library.folders list to one Default Location row", () => {
        const parsed = parseMainSettings({ library: { folders: [] } }, path.join("os", "temp"));
        expect(parsed.library.folders).toHaveLength(1);
        expect(parsed.library.folders[0]?.isDefaultLocation).toBe(true);
        expect(parsed.library.folders[0]?.path).toBe("");
    });
});
