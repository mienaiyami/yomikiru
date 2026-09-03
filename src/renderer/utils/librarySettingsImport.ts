import {
    type LibraryFolder,
    listForeignLibraryFolderSkipPaths,
} from "@common/library/folders";
import type { LibraryItemWithProgress } from "@common/types/db";
import i18n from "@renderer/i18n";
import { dialogUtils } from "@utils/dialog";
import { promptSelectDir } from "@utils/file";
import { pathIsInsideRoot, rendererLibraryIo } from "@utils/mangaChapters";

export {
    isDuplicateLibraryFolderPath,
    isLibraryFolderContent,
    newExtraLibraryFolder as newLibraryFolderSetting,
} from "@common/library/folders";

/**
 * Max allowed skew between catalogue `createdAt` and progress `lastReadAt` for the
 * unused-progress heuristic. Upgrade: store an explicit "never read" flag on add.
 */
export const UNUSED_PROGRESS_CREATED_AT_WINDOW_MS = 120_000;

/**
 * Returns trimmed default-location path when it exists on disk; otherwise `null`.
 */
export const getExistingBaseDir = (raw: string | undefined): string | null => {
    const baseDir = raw?.trim();
    if (!baseDir || !window.fs.existsSync(baseDir)) return null;
    return baseDir;
};

/**
 * Asks how to initialize an empty Default Location.
 * Choosing immediately opens the folder picker; deferring returns the normalized system home path.
 *
 * @returns Selected/default path, or `null` when the folder picker is cancelled
 */
export const promptForInitialDefaultLocation = async (homePath: string): Promise<string | null> => {
    const { response } = await dialogUtils.confirm({
        title: i18n.t("app.initialLibraryRootTitle", { ns: "common" }),
        message: i18n.t("app.initialLibraryRootMessage", { ns: "common" }),
        detail: i18n.t("app.initialLibraryRootDetail", { ns: "common" }),
        noOption: false,
        buttons: [
            i18n.t("app.chooseLibraryRootNow", { ns: "common" }),
            i18n.t("app.chooseLibraryRootLater", { ns: "common" }),
        ],
        defaultId: 0,
        cancelId: 1,
        type: "question",
    });
    if (response === 1) {
        const fallback = homePath.trim();
        return fallback ? window.path.normalize(fallback) : null;
    }
    const selected = await promptSelectDir(undefined, false);
    return Array.isArray(selected) ? (selected[0] ?? null) : selected;
};

/**
 * Unique existing library-folder paths (Default Location and extras) for Scan now.
 */
export const existingLibraryFolderPaths = (folders: readonly LibraryFolder[]): string[] => {
    const out: string[] = [];
    for (const folder of folders) {
        const p = getExistingBaseDir(folder.path);
        if (!p) continue;
        const n = window.path.normalize(p);
        if (out.some((existing) => window.path.normalize(existing) === n)) continue;
        out.push(p);
    }
    return out;
};

/**
 * Other scan roots that a walk of `currentRoot` must not enter.
 * Nested library folders (including Default Location) are included. The current root and any
 * ancestor of it are omitted so descendants are still walked.
 */
export const listForeignLibraryScanSkipPaths = (
    currentRoot: string,
    folders: readonly LibraryFolder[],
): string[] =>
    listForeignLibraryFolderSkipPaths(
        rendererLibraryIo(),
        currentRoot,
        folders.map((folder) => folder.path),
    );

/**
 * Catalogue links that sit under `rootPath` and not under a foreign skip root.
 * Used to backfill folder tags onto items already in the library.
 */
export const libraryItemLinksUnderScanRoot = (
    itemLinks: readonly string[],
    rootPath: string,
    skipRoots: readonly string[],
): string[] =>
    itemLinks.filter((link) => {
        if (!pathIsInsideRoot(link, rootPath)) return false;
        return !skipRoots.some((skip) => pathIsInsideRoot(link, skip));
    });

/**
 * True when progress exists but looks like a leftover from add-on-open (never actually read).
 * Manga: first page, no chapters marked read, timestamps within {@link UNUSED_PROGRESS_CREATED_AT_WINDOW_MS}.
 * Book: empty position and the same timestamp window.
 */
export const isUnusedDummyProgress = (item: LibraryItemWithProgress): boolean => {
    if (!item.progress) return false;
    const createdAtMs = new Date(item.createdAt).getTime();
    const lastReadAtMs = new Date(item.progress.lastReadAt).getTime();
    if (!Number.isFinite(createdAtMs) || !Number.isFinite(lastReadAtMs)) return false;
    if (Math.abs(lastReadAtMs - createdAtMs) > UNUSED_PROGRESS_CREATED_AT_WINDOW_MS) return false;
    if (item.type === "manga") {
        const chapters = item.progress.chaptersRead;
        return item.progress.currentPage === 1 && (!Array.isArray(chapters) || chapters.length === 0);
    }
    return item.progress.position.trim() === "";
};

/**
 * Catalogue links whose progress {@link isUnusedDummyProgress} would drop.
 */
export const unusedDummyProgressLinks = (
    items: Readonly<Record<string, LibraryItemWithProgress | null | undefined>>,
): string[] =>
    Object.values(items)
        .filter((item): item is LibraryItemWithProgress => item != null && isUnusedDummyProgress(item))
        .map((item) => item.link);
