import { describe, expect, it } from "vitest";
import {
    bookReaderSettingsSchema,
    defaultBookReaderSettings,
    defaultMangaReaderSettings,
    mangaReaderSettingsSchema,
} from "./readerSettingsSchema";

describe("readerSettingsSchema", () => {
    it("accepts the shipped manga / book defaults", () => {
        expect(mangaReaderSettingsSchema.parse(defaultMangaReaderSettings)).toEqual(defaultMangaReaderSettings);
        expect(bookReaderSettingsSchema.parse(defaultBookReaderSettings)).toEqual(defaultBookReaderSettings);
    });

    it("rejects invalid manga readerType / fitOption literals", () => {
        expect(
            mangaReaderSettingsSchema.safeParse({
                ...defaultMangaReaderSettings,
                readerTypeSelected: 9,
            }).success,
        ).toBe(false);
        expect(
            mangaReaderSettingsSchema.safeParse({
                ...defaultMangaReaderSettings,
                fitOption: 4,
            }).success,
        ).toBe(false);
    });

    it("rejects out-of-range customColorFilter channels", () => {
        expect(
            mangaReaderSettingsSchema.safeParse({
                ...defaultMangaReaderSettings,
                customColorFilter: {
                    ...defaultMangaReaderSettings.customColorFilter,
                    r: 300,
                },
            }).success,
        ).toBe(false);
    });
});
