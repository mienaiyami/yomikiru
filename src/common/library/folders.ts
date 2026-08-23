import { libraryIo } from "@common/library/io";
import {
    clampLibraryScanMaxDepth,
    LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    LIBRARY_SCAN_MAX_DEPTH_CEILING,
} from "@common/types/libraryScan";
import { z } from "zod";

export { clampLibraryScanMaxDepth, LIBRARY_SCAN_DEFAULT_MAX_DEPTH, LIBRARY_SCAN_MAX_DEPTH_CEILING };

/** Which file kinds a library-folder row is allowed to contribute during scan. */
export type LibraryFolderContent = "manga" | "book" | "both";

/**
 * One library root in MainSettings `library.folders`.
 * Exactly one row is {@link LibraryFolder.isDefaultLocation}; that row may have an empty path.
 */
export type LibraryFolder = {
    path: string;
    isDefaultLocation: boolean;
    content: LibraryFolderContent;
    maxDepth: number;
    scanOnStart: boolean;
    scanIntervalMinutes: number;
    watch: boolean;
    lastScanAtMs: number;
    skipPattern: string;
    tagIds: number[];
};

const LIBRARY_FOLDER_CONTENT = ["manga", "book", "both"] as const;

/** Whole-minute scan interval; fractional values read from disk are truncated. */
const scanIntervalMinutesSchema = z
    .number()
    .min(0)
    .transform((value) => Math.trunc(value))
    .pipe(z.number().int().min(0));

/**
 * One {@link LibraryFolder} row as stored in main-settings.json.
 * Unknown keys are stripped. Empty `path` is valid (Default Location not picked yet).
 */
export const libraryFolderSchema = z
    .object({
        path: z.string().default(""),
        isDefaultLocation: z.boolean().default(false),
        content: z.union([z.literal("manga"), z.literal("book"), z.literal("both")]).default("both"),
        maxDepth: z
            .number()
            .int()
            .min(0)
            .max(LIBRARY_SCAN_MAX_DEPTH_CEILING)
            .default(LIBRARY_SCAN_DEFAULT_MAX_DEPTH),
        scanOnStart: z.boolean().default(false),
        scanIntervalMinutes: scanIntervalMinutesSchema.default(0),
        watch: z.boolean().default(false),
        lastScanAtMs: z.number().min(0).default(0),
        skipPattern: z.string().default(""),
        tagIds: z.array(z.number().int().positive()).default([]),
    })
    .strip();

/**
 * Flagged Default Location row with an empty path and scan flags off.
 * Loader uses this when the file has no flagged row.
 */
export const emptyDefaultLibraryFolder = (): LibraryFolder => ({
    path: "",
    isDefaultLocation: true,
    content: "both",
    maxDepth: LIBRARY_SCAN_DEFAULT_MAX_DEPTH,
    scanOnStart: false,
    scanIntervalMinutes: 0,
    watch: false,
    lastScanAtMs: 0,
    skipPattern: "",
    tagIds: [],
});

/**
 * Extra (non-default) library folder after the user picks a directory.
 * Scan-on-start / interval / watch stay off until the user enables them.
 * Path is normalized with the process {@link libraryIo}.
 */
export const newExtraLibraryFolder = (folderPath: string): LibraryFolder => ({
    ...emptyDefaultLibraryFolder(),
    path: libraryIo().path.normalize(folderPath.trim()),
    isDefaultLocation: false,
});

/**
 * Enforces D16: exactly one flagged Default Location row, extras cannot be empty, extras cannot
 * steal the flag. None flagged -> prepend an empty default. Several flagged -> keep the first.
 */
export const normalizeLibraryFolders = (folders: readonly LibraryFolder[]): LibraryFolder[] => {
    const withFlags = folders.map((folder) => ({
        ...folder,
        isDefaultLocation: Boolean(folder.isDefaultLocation),
        path: folder.path ?? "",
    }));
    const firstFlagged = withFlags.findIndex((folder) => folder.isDefaultLocation);
    const ensured =
        firstFlagged < 0
            ? [
                  emptyDefaultLibraryFolder(),
                  ...withFlags.map((folder) => ({ ...folder, isDefaultLocation: false })),
              ]
            : withFlags.map((folder, index) => ({
                  ...folder,
                  isDefaultLocation: index === firstFlagged,
              }));
    return ensured.filter((folder) => folder.isDefaultLocation || folder.path.trim() !== "");
};

/** MainSettings `library` block. Missing / empty `folders` heals to one empty default row. */
export const librarySettingsSchema = z
    .object({
        folders: z.array(libraryFolderSchema).default([]).transform(normalizeLibraryFolders),
    })
    .strip()
    .default({});

export type LibrarySettings = z.infer<typeof librarySettingsSchema>;

/**
 * The unique Default Location row. After {@link normalizeLibraryFolders} this always exists.
 */
export const getDefaultLocationFolder = (folders: readonly LibraryFolder[]): LibraryFolder =>
    folders.find((folder) => folder.isDefaultLocation) ?? emptyDefaultLibraryFolder();

/** Path of the flagged Default Location row (may be empty). */
export const getDefaultLocationPath = (folders: readonly LibraryFolder[]): string =>
    getDefaultLocationFolder(folders).path;

/**
 * How the Locations browser recovers when `link` is empty or missing on disk.
 * First-run / missing Default Location is owned by App's folder picker, not the tab.
 */
export type LocationsListPlan =
    | { kind: "list"; path: string }
    | { kind: "idle" }
    | { kind: "reset"; path: string; warn: boolean };

/**
 * Plans the Locations browser load: list `link` when it exists, otherwise reset to
 * Default Location when that path exists, otherwise idle.
 */
export const planLocationsListLoad = (
    link: string,
    defaultPath: string,
    exists: (p: string) => boolean,
): LocationsListPlan => {
    if (link && exists(link)) return { kind: "list", path: link };
    const fallback = defaultPath.trim();
    if (fallback && exists(fallback)) {
        return { kind: "reset", path: fallback, warn: Boolean(link) };
    }
    return { kind: "idle" };
};

/**
 * Re-points the flagged row. Does not create a second default. Empty `nextPath` is allowed.
 */
export const setDefaultLocationPath = (folders: readonly LibraryFolder[], nextPath: string): LibraryFolder[] => {
    const pathValue = nextPath.trim();
    return normalizeLibraryFolders(
        folders.map((folder) => (folder.isDefaultLocation ? { ...folder, path: pathValue } : folder)),
    );
};

/**
 * True when `candidate` matches an existing folder path after trim + normalize.
 * Empty candidates are never duplicates (Default Location may be empty).
 */
export const isDuplicateLibraryFolderPath = (
    folders: readonly Pick<LibraryFolder, "path">[],
    candidate: string,
): boolean => {
    const trimmed = candidate.trim();
    if (!trimmed) return false;
    const { normalize } = libraryIo().path;
    const n = normalize(trimmed);
    return folders.some((folder) => {
        const existing = folder.path.trim();
        return existing !== "" && normalize(existing) === n;
    });
};

/**
 * Narrows a select value to a library-folder content filter.
 */
export const isLibraryFolderContent = (value: string): value is LibraryFolderContent =>
    (LIBRARY_FOLDER_CONTENT as readonly string[]).includes(value);

/**
 * Removes `deletedTagId` from every folder's `tagIds`.
 *
 * @returns whether any row actually dropped the id
 */
export const pruneLibraryFolderTagId = (
    folders: readonly LibraryFolder[],
    deletedTagId: number,
): { folders: LibraryFolder[]; changed: boolean } => {
    let changed = false;
    const next = folders.map((folder) => {
        if (!folder.tagIds.includes(deletedTagId)) return folder;
        changed = true;
        return { ...folder, tagIds: folder.tagIds.filter((id) => id !== deletedTagId) };
    });
    return { folders: next, changed };
};

/**
 * Extra (non-default) rows for the Settings folder list.
 */
export const extraLibraryFolders = (folders: readonly LibraryFolder[]): LibraryFolder[] =>
    folders.filter((folder) => !folder.isDefaultLocation);

/**
 * Replaces one row matched by `match`. Used when patching Default Location or an extra folder.
 */
export const patchLibraryFolder = (
    folders: readonly LibraryFolder[],
    match: (folder: LibraryFolder) => boolean,
    patch: Partial<LibraryFolder>,
): LibraryFolder[] =>
    normalizeLibraryFolders(folders.map((folder) => (match(folder) ? { ...folder, ...patch } : folder)));

/**
 * True when `intervalMinutes` is on and enough time has passed since `lastScanAtMs`.
 * Unset last-scan stamps (`<= 0`) count as never scanned.
 */
export const isLibraryScanDue = (lastScanAtMs: number, intervalMinutes: number, now = Date.now()): boolean => {
    if (intervalMinutes <= 0) return false;
    if (lastScanAtMs <= 0) return true;
    return now - lastScanAtMs >= intervalMinutes * 60_000;
};

/**
 * Stamps `lastScanAtMs` on folders whose path is in `scannedPaths`.
 */
export const withLibraryScanTimestamps = (
    folders: readonly LibraryFolder[],
    scannedPaths: readonly string[],
    now = Date.now(),
): LibraryFolder[] => {
    const { normalize } = libraryIo().path;
    const scanned = new Set(scannedPaths.map((p) => normalize(p.trim())));
    return folders.map((folder) => {
        const n = normalize(folder.path.trim());
        if (!n || !scanned.has(n)) return folder;
        return { ...folder, lastScanAtMs: now };
    });
};

/**
 * True when `folders` from disk need a D16 heal write (missing or not-exactly-one flag).
 */
export const libraryFoldersNeedHeal = (rawFolders: unknown): boolean => {
    if (!Array.isArray(rawFolders)) return true;
    const flagged = rawFolders.filter(
        (row) =>
            row !== null && typeof row === "object" && (row as { isDefaultLocation?: unknown }).isDefaultLocation,
    );
    return flagged.length !== 1;
};
