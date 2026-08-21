import type { BookProgress, LibraryItem, LibraryItemWithProgress, MangaProgress } from "@common/types/db";
import { applyMangaCoverAfterChapterLoad } from "@features/reader/services/readerCoverFlows";
import { relocateGalleryTrackContext } from "@store/anilist";
import { updateMangaBookmark } from "@store/bookmarks";
import store, { type AppDispatch } from "@store/index";
import {
    addLibraryItem,
    deleteLibraryItem,
    relocateLibraryItem,
    updateBookProgress,
    updateLibraryItem,
    updateMangaProgress,
} from "@store/library";
import { updateReaderContent } from "@store/reader";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { materializeBookCoverFromExtractedPath, materializeMangaRootAfterAdd } from "@utils/libraryCoverService";
import { mangaDedicatedCoverPathForDb } from "@utils/libraryCoverSources";
import { createRendererLogger } from "@utils/logger";
import {
    isMangaRootChapterName,
    normalizeMangaPathSegment,
    resolveMangaOpenSeries,
} from "@utils/mangaChapterPath";
import i18n from "../i18n";

const log = createRendererLogger("utils/libraryMissingPath");

type LibraryItemsMap = Record<string, LibraryItem | null | undefined>;

/** How {@link resolveMissingOpenPath} recovered a missing open path. */
export type MissingOpenPathKind = "openFirstChapter" | "locateChapter" | "relocate";

/** Successful result from {@link resolveMissingOpenPath}. */
export type MissingOpenPathResolution = {
    openPath: string;
    kind: MissingOpenPathKind;
};

type DialogAction = "locate" | "openFirstChapter" | "locateChapter" | "remove" | "cancel";

const tMissing = (key: string, vars?: Record<string, string>): string =>
    i18n.t(`libraryMissing.${key}`, { ns: "common", ...vars });

const tCommon = (key: string): string => i18n.t(key, { ns: "common" });

/**
 * Reader page for a missing-path recovery. Open first chapter always starts at 0;
 * Locate chapter keeps a bookmark page when provided.
 */
export const mangaPageForMissingKind = (kind: MissingOpenPathKind, bookmarkPage?: number): number | undefined => {
    if (kind === "openFirstChapter") return 0;
    if (kind === "locateChapter") return bookmarkPage ?? 0;
    return undefined;
};

/**
 * Updates a manga bookmark's chapterName from a picked chapter path.
 * Shows a catalog error and rethrows on failure so the open is aborted.
 */
export const updateMangaBookmarkChapterFromPath = async (
    dispatch: AppDispatch,
    bookmarkId: number,
    chapterPath: string,
): Promise<void> => {
    try {
        await dispatch(
            updateMangaBookmark({
                id: bookmarkId,
                chapterName: window.path.basename(chapterPath),
            }),
        ).unwrap();
    } catch (err) {
        await dialogUtils.customError({
            message: i18n.t("classic.listItem.missing.bookmarkUpdateFailed", { ns: "home" }),
        });
        throw err;
    }
};

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
 * Catalogue rows of `type` whose path is missing on disk and whose display name matches `newLink`.
 * Used before add so a moved folder can relocate instead of creating a duplicate.
 */
export const findMissingSameNameCandidates = (
    items: LibraryItemsMap,
    newLink: string,
    type: LibraryItem["type"],
): LibraryItem[] => {
    const target = normalizeMangaPathSegment(newLink);
    const out: LibraryItem[] = [];
    for (const item of Object.values(items)) {
        if (!item || item.type !== type) continue;
        if (normalizeMangaPathSegment(item.link) === target) continue;
        if (window.fs.existsSync(item.link)) continue;
        if (doesRelocateNameMatch(item.link, newLink, item.title, type)) out.push(item);
    }
    return out;
};

/**
 * Whether Locate on disk should be offered for a missing open path.
 * Only when the library root itself is gone - a missing chapter under an existing series
 * must not rewrite the library link to a chapter folder.
 */
export const shouldOfferLibraryRelocate = (libraryRootLink: string): boolean =>
    !window.fs.existsSync(libraryRootLink);

/**
 * Manga-only: chapter open path is missing but the series folder still exists.
 * Books/EPUBs never hit this (their library link is the file itself).
 */
export const shouldOfferMissingMangaChapterActions = (
    libraryItem: Pick<LibraryItem, "type" | "link">,
    openPath: string,
): boolean => {
    if (libraryItem.type !== "manga") return false;
    if (!window.fs.existsSync(libraryItem.link) || !window.fs.isDir(libraryItem.link)) return false;
    const root = normalizeMangaPathSegment(libraryItem.link);
    const open = normalizeMangaPathSegment(openPath);
    return open !== root && open.startsWith(root + window.path.sep);
};

/** Packed archive/PDF or a folder that contains images (not cover-only series roots). */
const isReadableMangaChapterPath = async (chapterPath: string): Promise<boolean> => {
    if (!window.fs.existsSync(chapterPath)) return false;
    const base = window.path.basename(chapterPath);
    if (!window.fs.isDir(chapterPath)) {
        return formatUtils.mangaFile.test(base);
    }
    const kids = await window.fs.readdir(chapterPath);
    return kids.some((file) => formatUtils.image.test(file));
};

/**
 * First name-sorted readable chapter under the series folder, or `null` if none.
 * Never returns the series root itself (cover-only roots are skipped).
 *
 * ponytail: immediate children only; upgrade: deeper trees / fuzzy rename match.
 */
export const pickFirstMangaChapterUnderRoot = async (libraryRoot: string): Promise<string | null> => {
    const root = normalizeMangaPathSegment(libraryRoot);
    if (!window.fs.existsSync(root) || !window.fs.isDir(root)) return null;

    const chapters: string[] = [];
    for (const name of await window.fs.readdir(root)) {
        const child = window.path.join(root, name);
        if (await isReadableMangaChapterPath(child)) chapters.push(child);
    }
    if (chapters.length === 0) return null;
    chapters.sort((a, b) =>
        window.path
            .basename(a)
            .localeCompare(window.path.basename(b), undefined, { numeric: true, sensitivity: "base" }),
    );
    return chapters[0];
};

/**
 * File/folder picker to choose a renamed or moved chapter under the series.
 * Defaults to the library root; rejects the series root itself and non-chapter paths.
 */
const pickMangaChapterPath = async (libraryRoot: string): Promise<string | null> => {
    const root = normalizeMangaPathSegment(libraryRoot);
    const result = await dialogUtils.showOpenDialog({
        properties: ["openDirectory", "openFile"],
        filters: formatUtils.dialogFilters.mangaFile(),
        defaultPath: window.fs.existsSync(root) ? root : undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const chosen = normalizeMangaPathSegment(result.filePaths[0]);
    if (chosen === root) {
        await dialogUtils.customError({ message: tMissing("selectChapterNotRoot") });
        return null;
    }
    if (!(await isReadableMangaChapterPath(chosen))) {
        await dialogUtils.customError({ message: tMissing("selectChapter") });
        return null;
    }
    return chosen;
};

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
    libraryItem?: LibraryItem | null;
    libraryItems?: LibraryItemsMap;
    detail?: string;
    removeLabel?: string;
    /** Defaults from {@link shouldOfferLibraryRelocate}. */
    offerLocate?: boolean;
    /** Defaults true when locate is offered or remove handlers are set. */
    offerRemove?: boolean;
    onRemove?: () => void | Promise<void>;
    /** After Locate chapter pick; not called for Open first chapter. */
    onLocateChapter?: (chapterPath: string) => void | Promise<void>;
};

const confirmMissingPath = async (
    actions: { label: string; action: DialogAction }[],
    detail: string,
    defaultId = 0,
): Promise<DialogAction> => {
    const { response } = await dialogUtils.confirm({
        type: "error",
        title: tMissing("missingTitle"),
        message: tMissing("missingMessage"),
        detail,
        noOption: false,
        buttons: actions.map((a) => a.label),
        defaultId,
        cancelId: actions.length - 1,
    });
    return actions[response]?.action ?? "cancel";
};

const promptMissingAction = async (opts: {
    detail?: string;
    removeLabel?: string;
    offerLocate: boolean;
    offerOpenFirstChapter: boolean;
    offerLocateChapter: boolean;
    offerRemove: boolean;
}): Promise<DialogAction> => {
    const remove = { label: opts.removeLabel ?? tCommon("actions.remove"), action: "remove" as const };
    const cancel = { label: tCommon("actions.cancel"), action: "cancel" as const };

    if (opts.offerLocateChapter && !opts.offerLocate) {
        return confirmMissingPath(
            [
                ...(opts.offerOpenFirstChapter
                    ? [{ label: tMissing("openFirstChapter"), action: "openFirstChapter" as const }]
                    : []),
                { label: tMissing("locateChapter"), action: "locateChapter" },
                ...(opts.offerRemove ? [remove] : []),
                cancel,
            ],
            opts.detail ?? tMissing("chapterMissingDetail"),
        );
    }

    if (!opts.offerLocate) {
        return confirmMissingPath(
            opts.offerRemove ? [remove, cancel] : [cancel],
            opts.detail ?? tMissing("chapterMissingDetail"),
            opts.offerRemove ? 1 : 0,
        );
    }

    return confirmMissingPath(
        [{ label: tMissing("locateOnDisk"), action: "locate" }, ...(opts.offerRemove ? [remove] : []), cancel],
        opts.detail ?? tMissing("missingDetail"),
    );
};

const isValidRelocateSelection = async (type: LibraryItem["type"], newLink: string): Promise<boolean> => {
    if (!window.fs.existsSync(newLink)) {
        await dialogUtils.customError({ message: tMissing("pathMissing") });
        return false;
    }
    if (type === "manga" && !window.fs.isDir(newLink) && !formatUtils.mangaFile.test(newLink)) {
        await dialogUtils.customError({ message: tMissing("selectManga") });
        return false;
    }
    if (type === "book" && (window.fs.isDir(newLink) || !formatUtils.book.test(newLink))) {
        await dialogUtils.customError({ message: tMissing("selectBook") });
        return false;
    }
    return true;
};

/**
 * Opens a directory (manga) or book-file picker, validates the selection, and asks for
 * confirmation when the chosen name does not match the previous path or library title.
 */
export const pickRelocatedLibraryPath = async (args: {
    type: LibraryItem["type"];
    oldLink: string;
    title: string;
}): Promise<string | null> => {
    const { type, oldLink, title } = args;
    const result = await dialogUtils.showOpenDialog({
        properties: type === "book" ? ["openFile"] : ["openDirectory", "openFile"],
        filters: type === "book" ? formatUtils.dialogFilters.book() : formatUtils.dialogFilters.mangaFile(),
        defaultPath: window.fs.existsSync(window.path.dirname(oldLink)) ? window.path.dirname(oldLink) : undefined,
    });
    if (result.canceled || result.filePaths.length === 0) return null;

    const newLink = window.path.normalize(result.filePaths[0]);
    if (!(await isValidRelocateSelection(type, newLink))) return null;

    if (!doesRelocateNameMatch(oldLink, newLink, title, type)) {
        const expected = libraryPathDisplayName(oldLink, type);
        const chosen = libraryPathDisplayName(newLink, type);
        const { response } = await dialogUtils.confirm({
            type: "warning",
            title: tMissing("nameMismatchTitle"),
            message: tMissing("nameMismatchMessage", { chosen, title: title || expected }),
            detail: tMissing("nameMismatchDetail", { expected }),
            noOption: false,
            buttons: [tMissing("useAnyway"), tCommon("actions.cancel")],
            defaultId: 1,
            cancelId: 1,
        });
        if (response !== 0) return null;
    }

    return newLink;
};

/**
 * Runs {@link relocateLibraryItem} and remaps session AniList gallery-track context on success.
 * Tracker rows are rewritten in the DB transaction.
 */
export const dispatchRelocateLibraryItem = async (
    dispatch: AppDispatch,
    args: { oldLink: string; newLink: string },
): Promise<LibraryItem | null> => {
    try {
        const item = await dispatch(relocateLibraryItem(args)).unwrap();
        if (!item) return null;
        dispatch(relocateGalleryTrackContext(args));
        return item;
    } catch (err) {
        log.error("dispatchRelocateLibraryItem failed", args, err);
        return null;
    }
};

/**
 * Relocates `oldLink` to `newLink`. If another catalogue row already occupies `newLink`,
 * asks to merge first. Cancel leaves both rows. Shows a relocate-failed dialog when the DB returns null.
 */
export const relocateLibraryItemWithOccupiedMerge = async (
    dispatch: AppDispatch,
    args: { oldLink: string; newLink: string },
): Promise<LibraryItem | null> => {
    const occupant = store.getState().library.items[normalizeMangaPathSegment(args.newLink)];
    if (occupant && occupant.link !== args.oldLink) {
        const { response } = await dialogUtils.confirm({
            type: "warning",
            title: tMissing("mergeTitle"),
            message: tMissing("mergeMessage"),
            noOption: false,
            buttons: [tMissing("mergeConfirm"), tCommon("actions.cancel")],
            defaultId: 1,
            cancelId: 1,
        });
        if (response !== 0) return null;
    }
    const item = await dispatchRelocateLibraryItem(dispatch, args);
    if (!item) {
        await dialogUtils.customError({ message: tMissing("relocateFailed") });
        return null;
    }
    return item;
};

const relocateAndRemap = async (
    dispatch: AppDispatch,
    libraryItem: LibraryItem,
    openPath: string,
): Promise<MissingOpenPathResolution | null> => {
    const newRoot = await pickRelocatedLibraryPath({
        type: libraryItem.type,
        oldLink: libraryItem.link,
        title: libraryItem.title,
    });
    if (!newRoot) return null;

    const item = await relocateLibraryItemWithOccupiedMerge(dispatch, {
        oldLink: libraryItem.link,
        newLink: newRoot,
    });
    if (!item) return null;

    const remapped = mapOpenPathAfterRelocate(libraryItem.link, newRoot, openPath);
    if (window.fs.existsSync(remapped)) return { openPath: remapped, kind: "relocate" };

    if (libraryItem.type === "manga" && window.fs.isDir(newRoot)) {
        const fallback = await pickFirstMangaChapterUnderRoot(newRoot);
        if (fallback) return { openPath: fallback, kind: "openFirstChapter" };
    }
    await dialogUtils.customError({ message: tMissing("chapterStillMissing") });
    return null;
};

/**
 * Prompt when `openPath` is missing: locate library root, open/locate a manga chapter, or remove.
 *
 * @returns Open path + recovery kind, or `null` if cancelled / removed / failed.
 */
export const resolveMissingOpenPath = async (
    dispatch: AppDispatch,
    openPath: string,
    opts: ResolveMissingOpenPathOpts = {},
): Promise<MissingOpenPathResolution | null> => {
    const libraryItem =
        opts.libraryItem ?? findLibraryItemForPath(opts.libraryItems ?? store.getState().library.items, openPath);

    if (!libraryItem) {
        await dialogUtils.customError({
            title: tMissing("missingTitle"),
            message: tMissing("missingMessage"),
            detail: openPath,
        });
        return null;
    }

    const offerLocate = opts.offerLocate ?? shouldOfferLibraryRelocate(libraryItem.link);
    const offerMangaChapter = !offerLocate && shouldOfferMissingMangaChapterActions(libraryItem, openPath);
    const offerRemove =
        opts.offerRemove ?? (offerLocate || opts.onRemove !== undefined || opts.removeLabel !== undefined);
    const firstChapter = offerMangaChapter ? await pickFirstMangaChapterUnderRoot(libraryItem.link) : null;

    const action = await promptMissingAction({
        offerLocate,
        offerOpenFirstChapter: Boolean(firstChapter),
        offerLocateChapter: offerMangaChapter,
        offerRemove,
        removeLabel: opts.removeLabel,
        detail: opts.detail,
    });

    if (action === "cancel") return null;
    if (action === "remove") {
        if (opts.onRemove) await opts.onRemove();
        else dispatch(deleteLibraryItem({ link: libraryItem.link }));
        return null;
    }
    if (action === "openFirstChapter") {
        if (!firstChapter) {
            await dialogUtils.customError({ message: tMissing("noChapterUnderSeries") });
            return null;
        }
        return { openPath: firstChapter, kind: "openFirstChapter" };
    }
    if (action === "locateChapter") {
        const chosen = await pickMangaChapterPath(libraryItem.link);
        if (!chosen) return null;
        if (opts.onLocateChapter) {
            try {
                await opts.onLocateChapter(chosen);
            } catch (err) {
                log.error("onLocateChapter failed", { openPath, chosen }, err);
                return null;
            }
        }
        return { openPath: chosen, kind: "locateChapter" };
    }

    return relocateAndRemap(dispatch, libraryItem, openPath);
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
        title: tCommon("contextMenu.removeFromLibrary"),
        message: tCommon("contextMenu.removeFromLibraryMessage"),
        noOption: false,
        buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
        defaultId: 0,
    });
    if (!response) return;
    dispatch(deleteLibraryItem({ link }));
    onRemoved?.();
};

/**
 * `chaptersRead` for the chapter just opened. Root-chapter tokens are not stored.
 */
export const chaptersReadForOpenedManga = (existing: string[] | undefined, chapterName: string): string[] => {
    const chaptersRead = Array.from(existing ?? []);
    if (!isMangaRootChapterName(chapterName)) chaptersRead.push(chapterName);
    return chaptersRead;
};

/** Inputs for {@link syncMangaLibraryOnReaderOpen}. */
export type SyncMangaLibraryOnOpenOpts = {
    dispatch: AppDispatch;
    openedPath: string;
    libraryItem: (LibraryItemWithProgress & { type: "manga" }) | null | undefined;
    images: string[];
    currentPage: number;
};

/** Series path, chapter key, and progress after {@link syncMangaLibraryOnReaderOpen}. */
export type SyncMangaLibraryOnOpenResult = {
    itemLink: string;
    chapterName: string;
    progress: MangaProgress;
};

/**
 * Inserts progress on a catalogue-only manga row (conflict path keeps stored title/cover).
 */
const persistCatalogueProgress = async (
    dispatch: AppDispatch,
    itemLink: string,
    title: string,
    chapterName: string,
    images: string[],
    currentPage: number,
): Promise<void> => {
    await dispatch(
        addLibraryItem({
            type: "manga",
            data: {
                type: "manga",
                link: itemLink,
                title,
                author: null,
                cover: mangaDedicatedCoverPathForDb(itemLink),
            },
            progress: {
                currentPage,
                totalPages: images.length,
                chapterName,
            },
        }),
    ).unwrap();
};

/**
 * Cover + reader content + progress for a manga row that already exists in the catalogue.
 */
const applyOpenedMangaItem = async (
    dispatch: AppDispatch,
    libraryItem: LibraryItemWithProgress & { type: "manga" },
    itemLink: string,
    chapterName: string,
    images: string[],
    currentPage: number,
): Promise<MangaProgress> => {
    const progress: MangaProgress = {
        currentPage,
        lastReadAt: new Date(),
        chapterName,
        itemLink,
        totalPages: images.length,
        chaptersRead: libraryItem.progress
            ? chaptersReadForOpenedManga(libraryItem.progress.chaptersRead, chapterName)
            : [],
    };
    try {
        await applyMangaCoverAfterChapterLoad({
            dispatch,
            libraryItem,
            mangaDir: itemLink,
            imgs: images,
        });
    } catch (err) {
        log.error("covers:materialize failed", err);
    }
    dispatch(updateReaderContent({ ...libraryItem, progress }));
    if (libraryItem.progress) {
        dispatch(updateMangaProgress(progress));
    } else {
        try {
            await persistCatalogueProgress(
                dispatch,
                itemLink,
                libraryItem.title,
                chapterName,
                images,
                currentPage,
            );
            dispatch(updateMangaProgress(progress));
        } catch (err) {
            log.error("addLibraryItem progress for catalogue row failed", err);
        }
    }
    return progress;
};

/**
 * Adds a new manga catalogue row with progress when open did not match an existing item.
 */
const addNewMangaOnOpen = async (
    dispatch: AppDispatch,
    itemLink: string,
    chapterName: string,
    images: string[],
    progress: MangaProgress,
): Promise<void> => {
    try {
        const added = await dispatch(
            addLibraryItem({
                type: "manga",
                data: {
                    type: "manga",
                    link: itemLink,
                    title: window.path.basename(itemLink),
                    author: null,
                    cover: mangaDedicatedCoverPathForDb(itemLink),
                },
                progress: {
                    currentPage: 1,
                    totalPages: images.length,
                    chapterName,
                },
            }),
        ).unwrap();
        dispatch(
            updateReaderContent({
                ...added,
                type: "manga",
                progress,
            }),
        );
        await materializeMangaRootAfterAdd({
            dispatch,
            libraryId: added?.id,
            mangaDir: itemLink,
            firstPageImage: images[0],
        });
    } catch (err) {
        log.error("addLibraryItem or cover materialize failed", err);
    }
};

/**
 * When opening a path not already in the catalogue, offers to relocate one missing
 * same-name row onto that path. Zero matches or a declined confirm means the caller should add.
 * Several matches warn then add (no picker).
 */
export const maybeRelocateMissingSameNameOnOpen = async (
    dispatch: AppDispatch,
    items: LibraryItemsMap,
    newLink: string,
    type: LibraryItem["type"],
): Promise<LibraryItem | null> => {
    const candidates = findMissingSameNameCandidates(items, newLink, type);
    if (candidates.length === 1 && candidates[0]) {
        const cand = candidates[0];
        const { response } = await dialogUtils.confirm({
            type: "question",
            title: tMissing("relocateInsteadConfirm"),
            message: tMissing("relocateInstead", { title: cand.title }),
            noOption: false,
            buttons: [tMissing("relocateInsteadConfirm"), tCommon("actions.cancel")],
            defaultId: 0,
            cancelId: 1,
        });
        if (response !== 0) return null;
        return dispatchRelocateLibraryItem(dispatch, {
            oldLink: cand.link,
            newLink,
        });
    }
    if (candidates.length > 1) {
        /*
         * ponytail: several same-name missing rows - do not pick silently.
         * Upgrade: a picker dialog. User can Locate from details.
         */
        await dialogUtils.warn({
            message: tMissing("severalMissingSameName"),
            noOption: true,
        });
    }
    return null;
};

/**
 * Ensures a manga catalogue row and progress when the reader loads images.
 * Relocate-before-add when exactly one missing same-name row matches.
 */
export const syncMangaLibraryOnReaderOpen = async (
    opts: SyncMangaLibraryOnOpenOpts,
): Promise<SyncMangaLibraryOnOpenResult> => {
    const { dispatch, openedPath, images, currentPage } = opts;
    const { itemLink, chapterName } = resolveMangaOpenSeries(openedPath, opts.libraryItem?.link ?? null);

    const progress: MangaProgress = {
        currentPage,
        lastReadAt: new Date(),
        chapterName,
        itemLink,
        totalPages: images.length,
        chaptersRead: [],
    };

    if (opts.libraryItem) {
        const next = await applyOpenedMangaItem(
            dispatch,
            opts.libraryItem,
            itemLink,
            chapterName,
            images,
            currentPage,
        );
        return { itemLink, chapterName, progress: next };
    }

    const relocated = await maybeRelocateMissingSameNameOnOpen(
        dispatch,
        store.getState().library.items,
        itemLink,
        "manga",
    );
    if (relocated) {
        const mapped = store.getState().library.items[normalizeMangaPathSegment(itemLink)];
        if (mapped?.type === "manga") {
            const next = await applyOpenedMangaItem(dispatch, mapped, itemLink, chapterName, images, currentPage);
            return { itemLink, chapterName, progress: next };
        }
    }

    await addNewMangaOnOpen(dispatch, itemLink, chapterName, images, progress);
    return { itemLink, chapterName, progress };
};

/** Inputs for {@link syncBookLibraryOnReaderOpen}. */
export type SyncBookLibraryOnOpenOpts = {
    dispatch: AppDispatch;
    openedPath: string;
    libraryItem: (LibraryItemWithProgress & { type: "book" }) | null | undefined;
    progress: BookProgress;
    title: string;
    author: string | null;
    /** Extracted EPUB cover path; materialized only when adding a new catalogue row. */
    coverAbsolutePath: string | null | undefined;
};

/**
 * Ensures a book catalogue row and progress when the EPUB reader loads a file.
 * Relocate-before-add when exactly one missing same-name row matches.
 * Does not replace stored CFI with an empty first-load position.
 */
export const syncBookLibraryOnReaderOpen = async (opts: SyncBookLibraryOnOpenOpts): Promise<void> => {
    const { dispatch, title, author, coverAbsolutePath } = opts;
    const itemLink = normalizeMangaPathSegment(opts.openedPath);
    const progress: BookProgress = { ...opts.progress, itemLink };

    let item = opts.libraryItem?.type === "book" ? opts.libraryItem : null;
    if (!item) {
        const relocated = await maybeRelocateMissingSameNameOnOpen(
            dispatch,
            store.getState().library.items,
            itemLink,
            "book",
        );
        if (relocated) {
            const mapped = store.getState().library.items[normalizeMangaPathSegment(itemLink)];
            if (mapped?.type === "book") item = mapped;
            else if (relocated.type === "book") {
                // relocate updates the dispatch store; the app singleton map can still hold the old key
                item = { ...relocated, type: "book", progress: null };
            }
        }
    }

    if (item) {
        const stored = item.progress;
        const openedEmpty = progress.position.trim() === "";
        const keepStored = Boolean(stored && stored.position.trim() !== "" && openedEmpty);
        const nextProgress = keepStored && stored ? { ...stored, itemLink } : progress;
        dispatch(updateReaderContent({ ...item, progress: nextProgress }));
        await dispatch(
            updateLibraryItem({
                link: itemLink,
                author,
                title,
            }),
        );
        if (!keepStored) await dispatch(updateBookProgress(progress));
        return;
    }

    try {
        const added = await dispatch(
            addLibraryItem({
                type: "book",
                data: {
                    type: "book",
                    link: itemLink,
                    title,
                    author,
                    cover: null,
                },
                progress,
            }),
        ).unwrap();
        dispatch(
            updateReaderContent({
                ...added,
                type: "book",
                progress,
            }),
        );
        await materializeBookCoverFromExtractedPath({
            dispatch,
            libraryId: added.id,
            coverAbsolutePath: coverAbsolutePath ?? undefined,
        });
    } catch (err) {
        log.error("addLibraryItem or book cover materialize failed", err);
    }
};
