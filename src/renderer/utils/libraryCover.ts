import type { LibraryItem } from "@common/types/db";

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
