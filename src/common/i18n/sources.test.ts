import { describe, expect, it } from "vitest";
import {
    BUILTIN_EN_SOURCE,
    BUILTIN_EN_SOURCE_ID,
    BUILTIN_SOURCES,
    isBuiltinSourceId,
    parseBuiltinSourceId,
} from "./builtins";
import { packSourceId, parsePackSourceId, resolveLanguageSource } from "./sources";

describe("language sources", () => {
    it("builds and parses pack source ids", () => {
        expect(packSourceId("ja-community")).toBe("pack:ja-community");
        expect(parsePackSourceId("pack:ja-community")).toBe("ja-community");
        expect(parsePackSourceId(BUILTIN_EN_SOURCE_ID)).toBeNull();
        expect(parsePackSourceId("pack:../escape")).toBeNull();
        expect(parsePackSourceId("pack:")).toBeNull();
    });

    it("parses registered builtin source ids", () => {
        expect(parseBuiltinSourceId("builtin:en")).toBe("en");
        expect(parseBuiltinSourceId("builtin:zz")).toBeNull();
        expect(isBuiltinSourceId("builtin:en")).toBe(true);
        expect(isBuiltinSourceId("pack:ja")).toBe(false);
        expect(BUILTIN_SOURCES.map((s) => s.id)).toEqual([BUILTIN_EN_SOURCE_ID]);
    });

    it("heals unknown source ids to builtin English", () => {
        const { source, healed } = resolveLanguageSource("pack:missing", [BUILTIN_EN_SOURCE]);
        expect(healed).toBe(true);
        expect(source.id).toBe(BUILTIN_EN_SOURCE_ID);
    });
});
