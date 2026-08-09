import type { LibraryItem } from "@common/types/db";
import { relocateAnilistTrackerLocalURL } from "@store/anilist";
import store, { type AppDispatch } from "@store/index";
import { deleteLibraryItem, relocateLibraryItem } from "@store/library";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { normalizeMangaPathSegment } from "@utils/mangaChapterPath";

const log = createRendererLogger("utils/libraryMissingPath");

type LibraryItemsMap = Record<string, LibraryItem | null | undefined>;

/** Context-menu / button label for picking a new path when a library file or folder is missing. */
export const LOCATE_ON_DISK_LABEL = "Locate on disk";

/**
 * Display name used when comparing a relocated path to the library entry
 * (folder basename for manga dirs; stem without extension for books and manga files).
 */
export const libraryPathDisplayName = (link: string, type: LibraryItem["type"]): string => {
    const base = window.path.basename(link);
    if (type === "book" || formatUtils.mangaFile.test(base)) {
        return window.path.basename(base, window.path.extname(base));
    }
    return base;
};

/**
 * True when the chosen path's display name matches the old path basename or the library title
 * (case-insensitive). Used to warn before linking a differently named folder/file.
 */
export const doesRelocateNameMatch = (
    oldLink: string,
    newLink: string,
    title: string,
    type: LibraryItem["type"],
): boolean => {
    const newName = libraryPathDisplayName(newLink, type).toLowerCase();
    const oldName = libraryPathDisplayName(oldLink, type).toLowerCase();
    const titleNorm = title.trim().toLowerCase();
    return newName === oldName || (titleNorm.length > 0 && newName === titleNorm);
};

/**
 * Whether Locate on disk should be offered for a missing open path.
 * Only when the library root itself is gone - a missing chapter under an existing series
 * must not rewrite the library link to a chapter folder.
 */
export const shouldOfferLibraryRelocate = (libraryRootLink: string): boolean =>
    !window.fs.existsSync(libraryRootLink);

/**
 * Finds the library row that owns `openPath` (exact link or longest root prefix).
 * Used when Open receives a chapter path under a manga folder.
 */
export const findLibraryItemForPath = (items: LibraryItemsMap, openPath: string): LibraryItem | null => {
    const norm = normalizeMangaPathSegment(openPath);
    const exact = items[norm] ?? items[openPath];
    if (exact) return exact;

    let best: LibraryItem | null = null;
    let bestLen = -1;
    for (const item of Object.values(items)) {
        if (!item?.link) continue;
        const root = normalizeMangaPathSegment(item.link);
        if (norm === root || norm.startsWith(root + window.path.sep)) {
            if (root.length > bestLen) {
                best = item;
                bestLen = root.length;
            }
        }
    }
    return best;
};

/**
 * Remaps an open path (library root or chapter under it) onto a relocated library root.
 */
export const mapOpenPathAfterRelocate = (oldRoot: string, newRoot: string, openPath: string): string => {
    const oldNorm = normalizeMangaPathSegment(oldRoot);
    const openNorm = normalizeMangaPathSegment(openPath);
    const newNorm = normalizeMangaPathSegment(newRoot);
    if (openNorm === oldNorm) return newNorm;
    const prefix = oldNorm + window.path.sep;
    if (openNorm.startsWith(prefix)) {
        return window.path.join(newNorm, openNorm.slice(prefix.length));
    }
    return newNorm;
};

type ResolveMissingOpenPathOpts = {
    /** Known library row; when omitted, looked up from {@link libraryItems}. */
    libraryItem?: LibraryItem | null;
    libraryItems?: LibraryItemsMap;
    detail?: string;
    removeLabel?: string;
    /**
     * When false, Locate is omitted.
     * Defaults from {@link shouldOfferLibraryRelocate} when a library item is known.
     */
    offerLocate?: boolean;
    /** Defaults to deleting the library row. */
    onRemove?: () => void | Promise<void>;
};

/**
 * Prompt when `openPath` is missing: locate (relocate library root) or remove.
 *
 * @returns Path that should be opened after a successful relocate, or `null` if cancelled / removed / failed.
 */
export const resolveMissingOpenPath = async (
    dispatch: AppDispatch,
    openPath: string,
    opts: ResolveMissingOpenPathOpts = {},
): Promise<string | null> => {
    const libraryItem =
        opts.libraryItem ?? findLibraryItemForPath(opts.libraryItems ?? store.getState().library.items, openPath);

    if (!libraryItem) {
        await dialogUtils.customError({
            title: "Missing from disk",
            message: "This file or folder was deleted or moved.",
            detail: openPath,
        });
        return null;
    }

    const offerLocate =
        opts.offerLocate !== undefined ? opts.offerLocate : shouldOfferLibraryRelocate(libraryItem.link);
    const action = await promptMissingLibraryPathAction({
        offerLocate,
        removeLabel: opts.removeLabel,
        detail: opts.detail,
    });
    if (action === "cancel") return null;
    if (action === "remove") {
        if (opts.onRemove) {
            await opts.onRemove();
        } else {
            dispatch(deleteLibraryItem({ link: libraryItem.link }));
        }
        return null;
    }

    const newRoot = await pickRelocatedLibraryPath({
        type: libraryItem.type,
        oldLink: libraryItem.link,
        title: libraryItem.title,
    });
    if (!newRoot) return null;

    const item = await dispatchRelocateLibraryItem(dispatch, {
        oldLink: libraryItem.link,
        newLink: newRoot,
    });
    if (!item) {
        await dialogUtils.customError({
            message: "Could not update library path. The new location may already be in the library.",
        });
        return null;
    }

    const remapped = mapOpenPathAfterRelocate(libraryItem.link, newRoot, openPath);
    if (!window.fs.existsSync(remapped)) {
        await dialogUtils.customError({
            message: "Library path updated, but this chapter file/folder is still missing under the new location.",
        });
        return null;
    }
    return remapped;
};

/**
 * Message box when a library path is missing on disk.
 *
 * @returns `"locate"` | `"remove"` | `"cancel"`
 */
export const promptMissingLibraryPathAction = async (opts?: {
    /** Defaults to explaining library-entry removal. */
    detail?: string;
    /** Middle (or sole primary) remove button label; defaults to `"Remove"`. */
    removeLabel?: string;
    /**
     * When false, Locate is omitted (open path missing but library root still present).
     * @default true
     */
    offerLocate?: boolean;
}): Promise<"locate" | "remove" | "cancel"> => {
    const offerLocate = opts?.offerLocate !== false;
    const removeLabel = opts?.removeLabel ?? "Remove";

    if (!offerLocate) {
        const { response } = await dialogUtils.confirm({
            type: "error",
            title: "Missing from disk",
            message: "This file or folder was deleted or moved.",
            detail:
                opts?.detail ??
                "The library item is still on disk, but this chapter path is missing. Remove the entry or cancel.",
            noOption: false,
            buttons: [removeLabel, "Cancel"],
            defaultId: 1,
            cancelId: 1,
        });
        return response === 0 ? "remove" : "cancel";
    }

    const { response } = await dialogUtils.confirm({
        type: "error",
        title: "Missing from disk",
        message: "This file or folder was deleted or moved.",
        detail: opts?.detail ?? "Locate it on disk to keep progress and bookmarks, or remove the library entry.",
        noOption: false,
        buttons: [LOCATE_ON_DISK_LABEL, removeLabel, "Cancel"],
        defaultId: 0,
        cancelId: 2,
    });
    if (response === 0) return "locate";
    if (response === 1) return "remove";
    return "cancel";
};

/**
 * Opens a directory (manga) or book-file picker, validates the selection, and asks for
 * confirmation when the chosen name does not match the previous path or library title.
 *
 * @returns Absolute path to use as the new library link, or `null` if cancelled / invalid.
 */
export const pickRelocatedLibraryPath = async (args: {
    type: LibraryItem["type"];
    oldLink: string;
    title: string;
}): Promise<string | null> => {
    const { type, oldLink, title } = args;

    const defaultPath = window.fs.existsSync(window.path.dirname(oldLink))
        ? window.path.dirname(oldLink)
        : undefined;

    const result = await dialogUtils.showOpenDialog({
        properties: type === "book" ? ["openFile"] : ["openDirectory", "openFile"],
        filters: type === "book" ? formatUtils.dialogFilters.book() : formatUtils.dialogFilters.mangaFile(),
        defaultPath,
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const newLink = window.path.normalize(result.filePaths[0]);
    if (!window.fs.existsSync(newLink)) {
        await dialogUtils.customError({ message: "Selected path does not exist." });
        return null;
    }
    if (type === "manga") {
        if (!window.fs.isDir(newLink) && !formatUtils.mangaFile.test(newLink)) {
            await dialogUtils.customError({
                message: "Select a manga folder or a supported archive/PDF file.",
            });
            return null;
        }
    }
    if (type === "book" && (window.fs.isDir(newLink) || !formatUtils.book.test(newLink))) {
        await dialogUtils.customError({ message: "Select a supported book file." });
        return null;
    }

    if (!doesRelocateNameMatch(oldLink, newLink, title, type)) {
        const expected = libraryPathDisplayName(oldLink, type);
        const chosen = libraryPathDisplayName(newLink, type);
        const { response } = await dialogUtils.confirm({
            type: "warning",
            title: "Name does not match",
            message: `Selected "${chosen}" does not match library item "${title || expected}".`,
            detail: `Previous path name: ${expected}. Use this location anyway?`,
            noOption: false,
            buttons: ["Use anyway", "Cancel"],
            defaultId: 1,
            cancelId: 1,
        });
        if (response !== 0) return null;
    }

    return newLink;
};

/**
 * Runs {@link relocateLibraryItem} and remaps AniList `localURL` on success.
 *
 * @returns Updated library row, or `null` on conflict / failure.
 */
export const dispatchRelocateLibraryItem = async (
    dispatch: AppDispatch,
    args: { oldLink: string; newLink: string },
): Promise<LibraryItem | null> => {
    try {
        const item = await dispatch(relocateLibraryItem(args)).unwrap();
        if (!item) return null;
        dispatch(relocateAnilistTrackerLocalURL(args));
        return item;
    } catch (err) {
        log.error("dispatchRelocateLibraryItem failed", args, err);
        return null;
    }
};

/**
 * Confirms and removes a library row (same wording as context-menu removeHistory).
 * Used by the gallery missing-path panel so Remove is not confirmed twice.
 */
export const confirmDeleteLibraryItem = async (
    dispatch: AppDispatch,
    link: string,
    onRemoved?: () => void,
): Promise<void> => {
    const { response } = await dialogUtils.warn({
        title: "Remove from Library",
        message:
            "Remove this item from library? Related bookmarks will also be removed. Files on disk are not deleted.",
        noOption: false,
        buttons: ["Cancel", "Yes"],
        defaultId: 0,
    });
    if (!response) return;
    dispatch(deleteLibraryItem({ link }));
    onRemoved?.();
};
