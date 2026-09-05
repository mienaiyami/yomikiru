import { describe, expect, it } from "vitest";
import {
    initReaderPresets,
    normalizeReaderPreset,
    parseBookPreset,
    parseLibraryItemReaderPresetId,
    parseMangaPreset,
    parsePresetImport,
    parseReaderPresetsStateWithMeta,
    resolveLibraryItemReaderPresetId,
    USER_PRESET_BOOK_ID,
    USER_PRESET_MANGA_ID,
} from "./readerPresets";

describe("parseMangaPreset / parseBookPreset", () => {
    it("repairs incomplete manga presets (including wrong type via defaults)", () => {
        const parsed = parseMangaPreset({ type: "manga", id: "x", name: "N" });
        expect(parsed?.type).toBe("manga");
        expect(parsed?.data).toBeTruthy();
        // repair fills literal "manga" from defaults when type is wrong
        expect(parseMangaPreset({ type: "book" })?.type).toBe("manga");
    });

    it("repairs incomplete book presets", () => {
        const parsed = parseBookPreset({ type: "book", id: "b", name: "B" });
        expect(parsed?.type).toBe("book");
        expect(parsed?.id).toBe("b");
    });
});

describe("normalizeReaderPreset / parsePresetImport", () => {
    it("routes by type and filters invalid entries", () => {
        expect(normalizeReaderPreset(null)).toBeNull();
        expect(normalizeReaderPreset({ type: "other" })).toBeNull();
        const list = parsePresetImport({
            presets: [
                { type: "manga", id: "m1", name: "M" },
                { type: "nope" },
                { type: "book", id: "b1", name: "B" },
            ],
        });
        expect(list.map((p) => p.id)).toEqual(["m1", "b1"]);
    });
});

describe("parseLibraryItemReaderPresetId", () => {
    it("returns a non-empty string id and ignores missing or invalid extra values", () => {
        expect(parseLibraryItemReaderPresetId({ readerPresetId: "manga-preset-long-strip" })).toBe(
            "manga-preset-long-strip",
        );
        expect(parseLibraryItemReaderPresetId(undefined)).toBeUndefined();
        expect(parseLibraryItemReaderPresetId({})).toBeUndefined();
        expect(parseLibraryItemReaderPresetId({ readerPresetId: "" })).toBeUndefined();
        expect(parseLibraryItemReaderPresetId({ readerPresetId: 1 })).toBeUndefined();
    });
});

describe("resolveLibraryItemReaderPresetId", () => {
    const presets = initReaderPresets.presets;

    it("returns the stored id only when a catalog preset of the same type exists", () => {
        expect(resolveLibraryItemReaderPresetId({ readerPresetId: USER_PRESET_MANGA_ID }, "manga", presets)).toBe(
            USER_PRESET_MANGA_ID,
        );
        expect(resolveLibraryItemReaderPresetId({ readerPresetId: USER_PRESET_BOOK_ID }, "book", presets)).toBe(
            USER_PRESET_BOOK_ID,
        );
        expect(
            resolveLibraryItemReaderPresetId({ readerPresetId: USER_PRESET_BOOK_ID }, "manga", presets),
        ).toBeUndefined();
        expect(resolveLibraryItemReaderPresetId({ readerPresetId: "gone" }, "manga", presets)).toBeUndefined();
        expect(resolveLibraryItemReaderPresetId({}, "manga", presets)).toBeUndefined();
    });
});

describe("parseReaderPresetsStateWithMeta", () => {
    it("returns bundled defaults when data is empty", () => {
        const { state, didNormalize } = parseReaderPresetsStateWithMeta(null);
        expect(didNormalize).toBe(true);
        expect(state.presets.some((p) => p.id === USER_PRESET_MANGA_ID)).toBe(true);
        expect(state.presets.some((p) => p.id === USER_PRESET_BOOK_ID)).toBe(true);
    });

    it("accepts a valid presets wrapper without rewriting", () => {
        const { state: defaults } = parseReaderPresetsStateWithMeta(null);
        const { state, didNormalize } = parseReaderPresetsStateWithMeta({ presets: defaults.presets });
        expect(didNormalize).toBe(false);
        expect(state.presets.length).toBe(defaults.presets.length);
    });
});
