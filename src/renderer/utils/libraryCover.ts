import type { DetailsCoverSource, ItemTracker, LibraryItem, LibraryItemExtra } from "@common/types/db";

/**
 * Builds a `file://` URL for gallery/detail `<img src>`, with `#` escaped for Electron.
 */
const absolutePathToFileUrl = (absPath: string): string => {
    return `file://${absPath.replaceAll("#", "%23")}`;
};

/**
 * Resolves `library_items.cover` when it may be absolute or a legacy `covers/...` fragment under userData.
 */
const coverDatabasePathToAbsolute = (c: string): string => {
    const t = c.trim();
    if (t.startsWith("/") || /^[A-Za-z]:[\\/]/.test(t)) return window.path.normalize(t);
    if (t.startsWith("covers/") || t.startsWith("covers\\")) {
        const rel = t.replaceAll("\\", "/");
        return window.path.join(window.electron.app.getPath("userData"), rel);
    }
    return window.path.join(window.electron.app.getPath("userData"), t);
};

/**
 * Canonical managed thumbnail written by main-process materialize: `userData/covers/<id>.webp`.
 */
export const canonicalCoverAbsolutePath = (libraryId: number): string => {
    return window.path.join(window.electron.app.getPath("userData"), "covers", `${libraryId}.webp`);
};

/**
 * Cover image URL for a library row: **DB `cover`** if that file exists (user-picked image or series-root `cover.*`),
 * else materialized **`userData/covers/<id>.webp`** (chapter-first-page and other app-generated thumbnails), else empty.
 */
export const libraryCoverSrc = (item: Pick<LibraryItem, "id" | "cover">): string => {
    const db = item.cover?.trim();
    if (db) {
        const abs = coverDatabasePathToAbsolute(db);
        if (window.fs.isFile(abs)) return absolutePathToFileUrl(abs);
    }
    const canonical = canonicalCoverAbsolutePath(item.id);
    if (window.fs.isFile(canonical)) return absolutePathToFileUrl(canonical);
    return "";
};

/**
 * Reads {@link LibraryItemExtra.detailsCoverSource}.
 * When that key is omitted, a non-empty tracker cover URL selects the tracker image.
 *
 * @param trackerCoverUrl Snapshot cover URL used only when extra does not name a source
 */
export const parseDetailsCoverSource = (
    extra: LibraryItemExtra | undefined,
    trackerCoverUrl?: string | null,
): DetailsCoverSource => {
    if (extra?.detailsCoverSource === "library") return "library";
    if (extra?.detailsCoverSource === "tracker") return "tracker";
    return trackerCoverUrl?.trim() ? "tracker" : "library";
};

/**
 * Cover URL for details and gallery tiles: tracker snapshot image when the resolved source
 * is tracker and a URL exists, otherwise {@link libraryCoverSrc}.
 */
export const resolveDetailsCoverSrc = (
    item: Pick<LibraryItem, "id" | "cover" | "extra">,
    trackerCoverUrl: string | null | undefined,
): string => {
    const trackerUrl = trackerCoverUrl?.trim() ?? "";
    if (parseDetailsCoverSource(item.extra, trackerUrl) === "tracker" && trackerUrl) return trackerUrl;
    return libraryCoverSrc(item);
};

/**
 * First non-empty tracker snapshot cover per library path.
 * ponytail: multiple providers can share a path; first row with an image wins until a picker exists.
 */
export const trackerCoverUrlByItemLink = (
    entries: readonly Pick<ItemTracker, "itemLink" | "media">[],
): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const row of entries) {
        if (map[row.itemLink]) continue;
        const url = row.media?.coverImage?.trim();
        if (url) map[row.itemLink] = url;
    }
    return map;
};
