import type { LibraryItemExtra } from "@common/types/db";
import { z } from "zod";
import { createRendererLogger } from "./logger";
import { getValueFromDeepObject } from "./objectPath";
import type { BookReaderSettings, MangaReaderSettings } from "./readerSettingsSchema";
import {
    bookReaderSettingsSchema,
    defaultBookReaderSettings,
    defaultMangaReaderSettings,
    mangaReaderSettingsSchema,
} from "./readerSettingsSchema";
import { repairZodInputWithDefaults } from "./zodRepair";

const log = createRendererLogger("utils/readerPresets");

export const mangaReaderPresetSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("manga"),
    data: mangaReaderSettingsSchema,
    autosave: z.boolean().default(false),
});

export const bookReaderPresetSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.literal("book"),
    data: bookReaderSettingsSchema,
    autosave: z.boolean().default(false),
});

export const readerPresetSchema = z.discriminatedUnion("type", [mangaReaderPresetSchema, bookReaderPresetSchema]);

export const readerPresetsStateSchema = z.object({
    presets: z.array(readerPresetSchema),
});

export type MangaReaderPreset = z.infer<typeof mangaReaderPresetSchema>;
export type BookReaderPreset = z.infer<typeof bookReaderPresetSchema>;
export type ReaderPreset = z.infer<typeof readerPresetSchema>;

export type ReaderPresetsState = {
    presets: ReaderPreset[];
};

export const USER_PRESET_MANGA_ID = "user-preset-manga";
export const USER_PRESET_BOOK_ID = "user-preset-book";

const initPresets: ReaderPreset[] = [
    {
        id: USER_PRESET_MANGA_ID,
        name: "User",
        type: "manga",
        autosave: true,
        data: defaultMangaReaderSettings,
    },
    {
        id: USER_PRESET_BOOK_ID,
        name: "User",
        type: "book",
        autosave: true,
        data: defaultBookReaderSettings,
    },
    {
        id: "manga-preset-paged-ltr",
        name: "Paged LTR",
        type: "manga",
        autosave: false,
        data: {
            ...defaultMangaReaderSettings,
            readerTypeSelected: 1,
            pagesPerRowSelected: 1,
            readingSide: 0,
            gapBetweenRows: true,
            fitOption: 1,
        } satisfies MangaReaderSettings,
    },
    {
        id: "manga-preset-long-strip",
        name: "Long Strip",
        type: "manga",
        autosave: false,
        data: {
            ...defaultMangaReaderSettings,
            readerTypeSelected: 0,
            pagesPerRowSelected: 0,
            gapBetweenRows: false,
            gapSize: 0,
        } satisfies MangaReaderSettings,
    },
    {
        id: "manga-preset-longstrip-gaps",
        name: "Long Strip with Gaps",
        type: "manga",
        autosave: false,
        data: {
            ...defaultMangaReaderSettings,
            readerTypeSelected: 0,
            pagesPerRowSelected: 0,
            gapBetweenRows: true,
            gapSize: 10,
        } satisfies MangaReaderSettings,
    },
    {
        id: "book-preset-default",
        name: "Default",
        type: "book",
        autosave: false,
        data: defaultBookReaderSettings satisfies BookReaderSettings,
    },
];

export const initReaderPresets: ReaderPresetsState = {
    presets: initPresets,
};
/**
 * @returns true if the id is the non-removable User preset for manga or book.
 */
export const isUserPresetId = (id: string): boolean => id === USER_PRESET_MANGA_ID || id === USER_PRESET_BOOK_ID;

/**
 * Reads {@link LibraryItemExtra.readerPresetId} when it is a non-empty string.
 */
export const parseLibraryItemReaderPresetId = (extra: LibraryItemExtra | undefined): string | undefined => {
    const id = extra?.readerPresetId;
    if (typeof id !== "string" || id.length === 0) return undefined;
    return id;
};

/**
 * Stored preset id when a catalog entry exists with that id and {@link ReaderPreset.type}.
 *
 * @param extra library row extra JSON
 * @param itemType catalog side to match ({@link ReaderPreset.type} / library_items.type)
 * @param presets in-memory reader preset catalog
 */
export const resolveLibraryItemReaderPresetId = (
    extra: LibraryItemExtra | undefined,
    itemType: "manga" | "book",
    presets: readonly ReaderPreset[],
): string | undefined => {
    const storedPresetId = parseLibraryItemReaderPresetId(extra);
    if (!storedPresetId) return undefined;
    return presets.some((preset) => preset.id === storedPresetId && preset.type === itemType)
        ? storedPresetId
        : undefined;
};

/**
 * First-run presets: defaults + User preset per type with current settings from app.
 * Preserves user's current reader settings so they persist when selecting other presets.
 */
export const buildFirstRunPresets = (
    mangaSettings: MangaReaderSettings,
    bookSettings: BookReaderSettings,
): ReaderPresetsState => ({
    presets: [
        ...initPresets.filter((p) => !isUserPresetId(p.id)),
        {
            id: USER_PRESET_MANGA_ID,
            name: "User",
            type: "manga",
            autosave: true,
            data: mangaSettings,
        },
        {
            id: USER_PRESET_BOOK_ID,
            name: "User",
            type: "book",
            autosave: true,
            data: bookSettings,
        },
    ],
});

const mangaPresetTopDefaults: MangaReaderPreset = {
    id: "",
    name: "Manga preset",
    type: "manga",
    autosave: false,
    data: defaultMangaReaderSettings,
};

const bookPresetTopDefaults: BookReaderPreset = {
    id: "",
    name: "Book preset",
    type: "book",
    autosave: false,
    data: defaultBookReaderSettings,
};

/**
 * Resolves default for a Zod path into `readerPresetsState` (uses `preset.type` for `data.*` defaults).
 */
const getDefaultForReaderPresetsPath = (fixed: Record<string, unknown>, path: (string | number)[]): unknown => {
    if (path[0] !== "presets" || path.length === 1) {
        return getValueFromDeepObject(initReaderPresets, path);
    }
    if (typeof path[1] !== "number") return undefined;
    const idx = path[1];
    const presets = fixed.presets as unknown[] | undefined;
    const preset = presets?.[idx] as { type?: string } | undefined;
    const t = preset?.type === "book" ? "book" : "manga";
    const topDefaults = t === "book" ? bookPresetTopDefaults : mangaPresetTopDefaults;
    const dataDefaults = t === "book" ? defaultBookReaderSettings : defaultMangaReaderSettings;
    if (path.length >= 3 && path[2] === "data") {
        if (path.length === 3) return dataDefaults;
        return getValueFromDeepObject(dataDefaults, path.slice(3));
    }
    return getValueFromDeepObject(topDefaults, path.slice(2));
};

/**
 * Parses a single preset from clipboard. Returns null if invalid.
 */
export const parseMangaPreset = (data: unknown): MangaReaderPreset | null => {
    const r = repairZodInputWithDefaults(mangaReaderPresetSchema, data, (path) =>
        path[0] === "data"
            ? getValueFromDeepObject(defaultMangaReaderSettings, path.slice(1))
            : getValueFromDeepObject(mangaPresetTopDefaults, path),
    );
    return r.success ? r.data : null;
};

/**
 * Parses a single preset from clipboard. Returns null if invalid.
 */
export const parseBookPreset = (data: unknown): BookReaderPreset | null => {
    const r = repairZodInputWithDefaults(bookReaderPresetSchema, data, (path) =>
        path[0] === "data"
            ? getValueFromDeepObject(defaultBookReaderSettings, path.slice(1))
            : getValueFromDeepObject(bookPresetTopDefaults, path),
    );
    return r.success ? r.data : null;
};

/**
 * Normalizes one preset object from storage or import; returns null if type is unknown or repair fails.
 */
export const normalizeReaderPreset = (raw: unknown): ReaderPreset | null => {
    if (!raw || typeof raw !== "object") return null;
    const t = (raw as { type?: string }).type;
    if (t === "manga") return parseMangaPreset(raw);
    if (t === "book") return parseBookPreset(raw);
    log.warn(`normalizeReaderPreset: dropped entry (unknown type ${String(t)})`);
    return null;
};

/**
 * Parses raw import data into validated presets. Accepts array or { presets: [...] }.
 * Returns only valid presets; filters by type when extracting manga/book.
 */
export const parsePresetImport = (data: unknown): ReaderPreset[] => {
    const arr = Array.isArray(data) ? data : ((data as { presets?: unknown[] })?.presets ?? []);
    return arr.map((p) => normalizeReaderPreset(p)).filter((p): p is ReaderPreset => p !== null);
};

/**
 * Parses persisted reader-presets JSON. Fast path when valid; otherwise fills missing/invalid fields from defaults
 * (same mechanism as `parseAppSettings` via `repairZodInputWithDefaults`); `didNormalize` signals callers to persist.
 */
export const parseReaderPresetsStateWithMeta = (
    data: unknown,
): { state: ReaderPresetsState; didNormalize: boolean } => {
    if (data == null || (typeof data === "object" && !("presets" in data) && !Array.isArray(data))) {
        return { state: initReaderPresets, didNormalize: true };
    }
    const rawWrapper: Record<string, unknown> = Array.isArray(data)
        ? { presets: data }
        : typeof data === "object" && data !== null
          ? { ...(data as object) }
          : {};

    const parsed = readerPresetsStateSchema.safeParse(rawWrapper);
    if (parsed.success) {
        if (parsed.data.presets.length === 0) {
            return { state: initReaderPresets, didNormalize: true };
        }
        return { state: parsed.data, didNormalize: false };
    }

    log.warn("readerPresets.json: schema mismatch; repairing fields from defaults", parsed.error.message);
    const repaired = repairZodInputWithDefaults(readerPresetsStateSchema, rawWrapper, (path, fixed) =>
        getDefaultForReaderPresetsPath(fixed, path),
    );
    if (!repaired.success) {
        log.warn("readerPresets.json: repair failed; loading bundled default presets");
        return { state: initReaderPresets, didNormalize: true };
    }
    if (repaired.data.presets.length === 0) {
        return { state: initReaderPresets, didNormalize: true };
    }
    return { state: repaired.data, didNormalize: true };
};
