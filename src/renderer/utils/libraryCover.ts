import { type ManagedCoverSlot, managedCoverFileName } from "@common/library/covers";
import type { DetailsCoverSource, ItemTracker, LibraryItem, LibraryItemExtra } from "@common/types/db";

/**
 * Builds a `file://` URL for gallery/detail `<img src>`, with `#` escaped for Electron.
 */
const absolutePathToFileUrl = (absPath: string): string => {
    return `file://${absPath.replaceAll("#", "%23")}`;
};

/**
 * Inverse of {@link absolutePathToFileUrl} for local cover `file://` URLs.
 *
 * @returns Absolute path when {@link fileUrl} is a non-empty `file://` URL from that helper
 */
export const fileUrlToAbsolutePath = (fileUrl: string): string | null => {
    const trimmed = fileUrl.trim();
    if (!trimmed.startsWith("file://")) return null;
    return trimmed.slice("file://".length).replaceAll("%23", "#");
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
 * Absolute path for a managed cover WebP under `userData/covers/`.
 * Filename comes from {@link managedCoverFileName} so main and renderer stay aligned.
 */
export const managedCoverAbsolutePath = (libraryId: number, slot: ManagedCoverSlot = "library"): string => {
    return window.path.join(
        window.electron.app.getPath("userData"),
        "covers",
        managedCoverFileName(libraryId, slot),
    );
};

/**
 * Library thumbnail slot (`covers/<id>.webp`).
 */
export const canonicalCoverAbsolutePath = (libraryId: number): string =>
    managedCoverAbsolutePath(libraryId, "library");

/**
 * Tracker-art slot (`covers/tracker-<id>.webp`), separate from the library thumbnail.
 */
export const trackerCoverAbsolutePath = (libraryId: number): string =>
    managedCoverAbsolutePath(libraryId, "tracker");

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
 * Whether a tracker snapshot has cover art (URL or color SVG). Used only as a source hint;
 * library views never load that string as an image source.
 */
export const hasTrackerCoverHint = (coverImage?: string | null): boolean => Boolean(coverImage?.trim());

/**
 * True when `covers/tracker-<id>.webp` exists on disk.
 */
export const hasLocalTrackerCover = (libraryId: number): boolean =>
    window.fs.isFile(trackerCoverAbsolutePath(libraryId));

/**
 * Reads {@link LibraryItemExtra.detailsCoverSource}.
 * When that key is omitted, a tracker cover hint selects the tracker slot.
 *
 * @param hasCoverHint Snapshot has cover art; used only when extra does not name a source
 */
export const parseDetailsCoverSource = (
    extra: LibraryItemExtra | undefined,
    hasCoverHint = false,
): DetailsCoverSource => {
    if (extra?.detailsCoverSource === "library") return "library";
    if (extra?.detailsCoverSource === "tracker") return "tracker";
    return hasCoverHint ? "tracker" : "library";
};

/**
 * Cover URL for gallery tiles and details. Non-empty values are always `file://` URLs from a
 * local disk path (tracker WebP, user-picked cover, or library thumbnail); never http(s).
 * Use {@link fileUrlToAbsolutePath} when IPC needs the underlying path.
 */
export const resolveDetailsCoverSrc = (
    item: Pick<LibraryItem, "id" | "cover" | "extra">,
    hasCoverHint: boolean,
): string => {
    const abs = resolveDetailsCoverAbsolutePath(item, hasCoverHint);
    return abs ? absolutePathToFileUrl(abs) : "";
};

/**
 * Absolute path for the cover image shown in gallery details (tracker WebP, user-picked
 * cover, or library thumbnail). Mirrors {@link resolveDetailsCoverSrc} without a file URL.
 *
 * @returns Path when a cover file exists on disk, otherwise `null`
 */
export const resolveDetailsCoverAbsolutePath = (
    item: Pick<LibraryItem, "id" | "cover" | "extra">,
    hasCoverHint: boolean,
): string | null => {
    if (parseDetailsCoverSource(item.extra, hasCoverHint) === "tracker") {
        const cached = trackerCoverAbsolutePath(item.id);
        if (window.fs.isFile(cached)) return cached;
    }
    const db = item.cover?.trim();
    if (db) {
        const abs = coverDatabasePathToAbsolute(db);
        if (window.fs.isFile(abs)) return abs;
    }
    const canonical = canonicalCoverAbsolutePath(item.id);
    if (window.fs.isFile(canonical)) return canonical;
    return null;
};

/**
 * First library path that has a tracker snapshot cover hint.
 * ponytail: multiple providers can share a path; first row with a hint wins until a picker exists.
 */
export const trackerCoverHintByItemLink = (
    entries: readonly Pick<ItemTracker, "itemLink" | "media">[],
): Record<string, true> => {
    const map: Record<string, true> = {};
    for (const row of entries) {
        if (map[row.itemLink]) continue;
        if (hasTrackerCoverHint(row.media?.coverImage)) map[row.itemLink] = true;
    }
    return map;
};
