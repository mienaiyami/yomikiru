import type { LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import AnilistBar from "@features/anilist/AnilistBar";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import {
    faBookmark,
    faBookOpen,
    faFolderOpen,
    faImage,
    faLocationDot,
    faPen,
    faSort,
    faStar,
    faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { setAppSettings } from "@store/appSettings";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    selectItemMetadata,
    setLibraryItemDetailsCoverSource,
    setLibraryItemFavourite,
    setLibraryItemNote,
    updateChaptersReadAll,
} from "@store/library";
import { selectTracker } from "@store/trackers";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { libraryCoverSrc, parseDetailsCoverSource, resolveDetailsCoverSrc } from "@utils/libraryCover";
import {
    materializeMangaLibraryThumbnail,
    pickAndApplyCustomCover,
    resetLibraryCoverToDefault,
} from "@utils/libraryCoverService";
import { resolveItemMetadata } from "@utils/libraryMetadata";
import {
    mangaPageForMissingKind,
    resolveMissingOpenPath,
    shouldOfferLibraryRelocate,
    updateMangaBookmarkChapterFromPath,
} from "@utils/libraryMissingPath";
import { createRendererLogger } from "@utils/logger";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { listMangaChapterChildren, type MangaChapterChild, resolveMangaStartPath } from "@utils/mangaChapters";
import { scrollChildInContainer } from "@utils/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import ListSelectionToolbar from "../../classic/components/ListSelectionToolbar";
import {
    DetailsCopyPathButton,
    DetailsFactField,
    DetailsHero,
    DetailsItemNote,
    DetailsListToolbar,
    DetailsMetaBlock,
    DetailsTabBar,
} from "./DetailsHero";
import { ItemMetadataEditor } from "./ItemMetadataEditor";
import { ItemTagsRow } from "./ItemTagsPicker";
import MissingLibraryPathPanel from "./MissingLibraryPathPanel";
import "./mangaDetailsPanel.scss";

const log = createRendererLogger("gallery/MangaDetailsPanel");

type MangaDetailsPanelProps = {
    mangaLink: string;
    onClose: () => void;
    /**
     * Inner tab shown on open. Omit to use this panel's default.
     * Parent remounts the panel (`key` = item link) when the selection changes.
     */
    initialTab?: "content" | "bookmarks";
    /** After Locate on disk succeeds, parent should select the new library link. */
    onRelocated?: (newLink: string) => void;
};

/**
 * Gallery details page for a library manga: shared hero plus inner list tabs.
 * Opening a chapter or bookmark launches the reader at the stored location.
 */
const MangaDetailsPanel = ({
    mangaLink,
    onClose,
    onRelocated,
    initialTab = "content",
}: MangaDetailsPanelProps) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const anilistToken = useAppSelector((store) => store.anilist.token);

    const [chapters, setChapters] = useState<MangaChapterChild[]>([]);
    const [activeTab, setActiveTab] = useState<"content" | "bookmarks">(initialTab);
    const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);
    const [itemNote, setItemNote] = useState("");
    const sortBy = useAppSelector((store) => store.appSettings.locationListSortBy);
    const sortOrder = useAppSelector((store) => store.appSettings.locationListSortType);

    const manga = library[mangaLink] as LibraryItemWithProgress & { type: "manga" };
    const overlays = useAppSelector((store) => selectItemMetadata(store, mangaLink));
    const tracker = useAppSelector((store) => selectTracker(store, mangaLink, "anilist"));
    /* book details uses the same overlay+tracker resolve; no shared hook until a third caller */
    const resolved = useMemo(
        () => (manga ? resolveItemMetadata({ item: manga, overlays, tracker }) : null),
        [manga, overlays, tracker],
    );
    const userOverlay = overlays.find((row) => row.source === "user");
    const isFavourite = Boolean(manga?.favouritedAt);

    useEffect(() => {
        setItemNote(manga?.note ?? "");
    }, [manga?.note]);
    const pathMissing = Boolean(manga) && !window.fs.existsSync(mangaLink);
    const bookmarksArray = useAppSelector(
        (store) =>
            [...((manga && store.bookmarks.manga[manga.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );
    const { setContextMenuData, openInReader } = useAppContext();
    const continueRef = useRef<HTMLButtonElement>(null);
    const chaptersListRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        continueRef.current?.focus();
    }, []);

    useEffect(() => {
        if (
            !manga?.id ||
            libraryCoverSrc(manga) ||
            !window.fs.existsSync(mangaLink) ||
            !window.fs.isDir(mangaLink)
        ) {
            return;
        }
        void (async () => {
            try {
                await materializeMangaLibraryThumbnail(dispatch, manga.id, mangaLink);
            } catch (err) {
                log.error("covers:materialize from details panel failed", err);
            }
        })();
    }, [mangaLink, manga?.id, dispatch]);

    const refreshChapters = useCallback(() => {
        const fetchChapters = async () => {
            try {
                if (window.fs.existsSync(mangaLink) && window.fs.isDir(mangaLink)) {
                    setChapters(await listMangaChapterChildren(mangaLink));
                } else {
                    setChapters([]);
                }
            } catch (error) {
                log.error("Error fetching chapters", error);
            }
        };

        void fetchChapters();
    }, [mangaLink]);

    useEffect(() => {
        refreshChapters();
    }, [refreshChapters]);

    const sortedChapters = useMemo(() => {
        if (!chapters.length) return [];

        let sorted: MangaChapterChild[];
        if (sortBy === "name") {
            sorted = [...chapters].sort((a, b) =>
                window.app.betterSortOrder(formatUtils.files.getName(a.name), formatUtils.files.getName(b.name)),
            );
        } else {
            // date
            sorted = [...chapters].sort((a, b) => b.dateModified - a.dateModified);
        }

        return sortOrder === "inverse" ? sorted.reverse() : sorted;
    }, [chapters, sortBy, sortOrder]);

    const chapterSourceIds = useMemo(() => sortedChapters.map((c) => c.name), [sortedChapters]);
    const bookmarkSourceIds = useMemo(() => bookmarksArray.map((b) => b.id), [bookmarksArray]);
    const chapterSelection = useMultiSelect<string>(chapterSourceIds);
    const bookmarkSelection = useMultiSelect<number>(bookmarkSourceIds);

    /* clear when the details tab changes; extra dep is a trigger */
    // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection on details tab change
    useEffect(() => {
        chapterSelection.clearSelection();
        bookmarkSelection.clearSelection();
    }, [activeTab, chapterSelection.clearSelection, bookmarkSelection.clearSelection]);

    const handleChapterClick = useCallback(
        (chapterLink: string) => {
            if (pathMissing) return;
            openInReader(chapterLink);
        },
        [openInReader, pathMissing],
    );

    const handleChapterContextMenu = useCallback(
        (e: React.MouseEvent, chapterLink: string, chapterName: string) => {
            e.preventDefault();

            const items: Menu.ListItem[] = [
                { ...window.contextMenu.template.open(chapterLink), disabled: pathMissing },
                { ...window.contextMenu.template.openInNewWindow(chapterLink), disabled: pathMissing },
                window.contextMenu.template.divider(),
            ];

            if (manga?.type === "manga") {
                const isRead = manga.progress?.chaptersRead.includes(chapterName) || false;
                if (isRead) {
                    items.push(window.contextMenu.template.unreadChapter(mangaLink, chapterName));
                } else {
                    items.push(window.contextMenu.template.readChapter(mangaLink, chapterName));
                }
                items.push(
                    window.contextMenu.template.readAllChapter(
                        mangaLink,
                        chapters.map((c) => c.name),
                    ),
                );
                items.push(window.contextMenu.template.unreadAllChapter(mangaLink));
            }

            items.push(window.contextMenu.template.divider());
            items.push(window.contextMenu.template.copyPath(chapterLink));
            items.push({
                ...window.contextMenu.template.showInExplorer(chapterLink),
                disabled: pathMissing,
            });

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [mangaLink, manga, setContextMenuData, chapters, pathMissing],
    );

    const handleSortClick = useCallback(
        (e: React.MouseEvent) => {
            const items = [
                {
                    label: t("shared.sort.name"),
                    action() {
                        dispatch(setAppSettings({ locationListSortBy: "name" }));
                    },
                    selected: sortBy === "name",
                },
                {
                    label: t("shared.sort.dateModified"),
                    action() {
                        dispatch(setAppSettings({ locationListSortBy: "date" }));
                    },
                    selected: sortBy === "date",
                },
                window.contextMenu.template.divider(),
                {
                    label: t("shared.sort.ascending"),
                    action() {
                        dispatch(setAppSettings({ locationListSortType: "normal" }));
                    },
                    selected: sortOrder === "normal",
                },
                {
                    label: t("shared.sort.descending"),
                    action() {
                        dispatch(setAppSettings({ locationListSortType: "inverse" }));
                    },
                    selected: sortOrder === "inverse",
                },
            ];

            setContextMenuData({
                clickX: e.currentTarget.getBoundingClientRect().x,
                clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
                padLeft: true,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [sortBy, sortOrder, setContextMenuData, t, dispatch],
    );

    const filterChapter = useCallback((filter: string, chapter: MangaChapterChild) => {
        return new RegExp(filter, "ig").test(chapter.name);
    }, []);

    const renderChapterItem = useCallback(
        (chapter: MangaChapterChild, _index: number, isSelected: boolean) => {
            const isRead = manga?.type === "manga" && manga.progress?.chaptersRead.includes(chapter.name);
            const progressPath =
                manga?.progress?.itemLink && manga?.progress?.chapterName
                    ? resolveMangaChapterPath(manga.progress.itemLink, manga.progress.chapterName)
                    : "";
            const isCurrent = progressPath === chapter.link;
            const inSelectionMode = chapterSelection.isSelectionMode;
            const isChecked = chapterSelection.isSelected(chapter.name);

            return (
                <div
                    key={chapter.link}
                    className={`chapter-item ${isRead ? "read" : ""} ${isCurrent ? "current" : ""} ${
                        isSelected ? "selected" : ""
                    } ${inSelectionMode ? "selectionMode" : ""} ${isChecked ? "multiSelected" : ""} ${
                        pathMissing ? "openDisabled" : ""
                    }`}
                    onClick={(e) => {
                        if (inSelectionMode) {
                            chapterSelection.toggleItem(chapter.name, { shiftKey: e.shiftKey });
                            return;
                        }
                        handleChapterClick(chapter.link);
                    }}
                    onContextMenu={(e) => handleChapterContextMenu(e, chapter.link, chapter.name)}
                    data-url={chapter.link}
                    data-focused={isSelected}
                >
                    <SelectionCheckbox
                        className="rowSelectCheck"
                        boxClassName="checkBox"
                        checked={isChecked}
                        onToggle={({ shiftKey }) => chapterSelection.toggleItem(chapter.name, { shiftKey })}
                        ariaLabel={t("shared.selectAria", { title: chapter.name })}
                    />
                    <span className="chapter-name">{formatUtils.files.getName(chapter.name)}</span>

                    <div className="chapter-meta">
                        {formatUtils.mangaFile.test(chapter.name) ? (
                            <code className="file-ext">{formatUtils.files.getExt(chapter.name)}</code>
                        ) : (
                            <span className="page-count">{chapter.pages}</span>
                        )}
                    </div>
                </div>
            );
        },
        [manga, handleChapterClick, handleChapterContextMenu, chapterSelection, pathMissing, t],
    );

    const handleBookmarkClick = useCallback(
        (bookmark: MangaBookmark) => {
            if (pathMissing || !manga) return;
            const bookmarkPath = resolveMangaChapterPath(bookmark.itemLink, bookmark.chapterName);
            /* home hides while reader is active, so window.app.scrollToPage is unset */

            if (window.fs.existsSync(bookmarkPath)) {
                openInReader(bookmarkPath, { mangaPageNumber: bookmark.page });
                return;
            }

            void (async () => {
                const resolved = await resolveMissingOpenPath(dispatch, bookmarkPath, {
                    libraryItem: manga,
                    offerLocate: shouldOfferLibraryRelocate(manga.link),
                    offerRemove: true,
                    removeLabel: tCommon("contextMenu.removeBookmark"),
                    detail: t("classic.listItem.missing.chapterMissingKeepBookmark"),
                    onRemove: () => {
                        dispatch(
                            removeBookmark({
                                itemLink: bookmark.itemLink,
                                ids: [bookmark.id],
                                type: "manga",
                            }),
                        );
                    },
                    onLocateChapter: (chapterPath) =>
                        updateMangaBookmarkChapterFromPath(dispatch, bookmark.id, chapterPath),
                });
                if (!resolved) return;
                openInReader(resolved.openPath, {
                    mangaPageNumber: mangaPageForMissingKind(resolved.kind, bookmark.page) ?? 0,
                });
            })();
        },
        [dispatch, manga, openInReader, pathMissing, t, tCommon],
    );

    const handleBookmarkContextMenu = useCallback(
        (e: React.MouseEvent, bookmark: MangaBookmark) => {
            e.preventDefault();
            e.stopPropagation();

            const items: Menu.ListItem[] = [
                {
                    ...window.contextMenu.template.openInNewWindow(bookmark.itemLink),
                    disabled: pathMissing,
                },
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "manga", true),
            ];

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [pathMissing, setContextMenuData],
    );

    const renderBookmarkItem = useCallback(
        (bookmark: MangaBookmark, _index: number, isSelected: boolean) => {
            const inSelectionMode = bookmarkSelection.isSelectionMode;
            const isChecked = bookmarkSelection.isSelected(bookmark.id);
            return (
                <div
                    key={bookmark.id}
                    className={`bookmark-item ${isSelected ? "selected" : ""} ${
                        inSelectionMode ? "selectionMode" : ""
                    } ${isChecked ? "multiSelected" : ""} ${pathMissing ? "openDisabled" : ""}`}
                    onClick={(e) => {
                        if (inSelectionMode) {
                            bookmarkSelection.toggleItem(bookmark.id, { shiftKey: e.shiftKey });
                            return;
                        }
                        handleBookmarkClick(bookmark);
                    }}
                    onContextMenu={(e) => handleBookmarkContextMenu(e, bookmark)}
                    data-focused={isSelected}
                    data-bookmark-id={bookmark.id}
                >
                    <SelectionCheckbox
                        className="rowSelectCheck"
                        boxClassName="checkBox"
                        checked={isChecked}
                        onToggle={({ shiftKey }) => bookmarkSelection.toggleItem(bookmark.id, { shiftKey })}
                        ariaLabel={t("gallery.details.selectBookmarkAria", { id: bookmark.id })}
                    />
                    <div className="bookmark-content">
                        <div className="bookmark-header">
                            {/* <span className="bookmark-icon">
                                <FontAwesomeIcon icon={faBookmark} />
                            </span> */}
                            <span className="bookmark-chapter">
                                {formatUtils.files.getName(bookmark.chapterName || "")}
                            </span>
                            <span className="bookmark-page">
                                {t("gallery.details.page", { page: bookmark.page })}
                            </span>
                        </div>

                        <div className="bookmark-date" title={bookmark.createdAt.toString()}>
                            {dateUtils.format(bookmark.createdAt, {
                                format: dateUtils.presets.dateTime,
                            })}
                        </div>

                        {bookmark.note && <p className="bookmark-note">{bookmark.note}</p>}
                    </div>
                </div>
            );
        },
        [handleBookmarkClick, handleBookmarkContextMenu, bookmarkSelection, pathMissing, t],
    );

    const filterBookmark = useCallback((filter: string, bookmark: MangaBookmark) => {
        return new RegExp(filter, "ig").test(bookmark.note || bookmark.chapterName || "");
    }, []);

    const handleContextMenu = useCallback((elem: HTMLElement) => {
        elem.dispatchEvent(window.contextMenu.fakeEvent(elem));
    }, []);

    const handleSelect = useCallback((elem: HTMLElement) => {
        elem.click();
    }, []);

    /**
     * Marks every chapter in the current selection as read (or unread). A
     * single batched IPC call updates the manga progress so the UI refreshes
     * once. Pass selected names and the read flag - the DB adds or removes by
     * that flag (do not pre-merge into an absolute chaptersRead list).
     */
    const handleBulkMarkChapters = useCallback(
        (read: boolean) => {
            const names = Array.from(chapterSelection.selectedIds);
            if (names.length === 0 || !manga?.progress) return;
            dispatch(updateChaptersReadAll({ itemLink: mangaLink, chapters: names, read }))
                .unwrap()
                .catch((err: unknown) => {
                    log.error("updateChaptersReadAll failed", err);
                });
            chapterSelection.clearSelection();
        },
        [chapterSelection, manga, mangaLink, dispatch],
    );

    const handleBulkDeleteBookmarks = useCallback(() => {
        const ids = Array.from(bookmarkSelection.selectedIds);
        if (ids.length === 0) return;
        dialogUtils
            .warn({
                title: t("gallery.details.deleteBookmarksTitle"),
                message: t("gallery.details.deleteBookmarksMessage", { count: ids.length }),
                noOption: false,
                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                dispatch(removeBookmark({ itemLink: mangaLink, type: "manga", ids }));
                bookmarkSelection.clearSelection();
            });
    }, [bookmarkSelection, mangaLink, dispatch, t, tCommon]);

    useSelectionShortcuts({
        selection: chapterSelection,
        enabled: activeTab === "content",
    });
    useSelectionShortcuts({
        selection: bookmarkSelection,
        enabled: activeTab === "bookmarks",
        onDelete: handleBulkDeleteBookmarks,
    });

    const handleSelectCover = useCallback(async () => {
        if (!manga) return;
        await pickAndApplyCustomCover({
            dispatch,
            libraryId: manga.id,
            link: mangaLink,
            defaultPath: mangaLink,
            errorLogLabel: "MangaDetailsPanel cover picker",
        });
    }, [manga, mangaLink, dispatch]);

    const handleResetCover = useCallback(async () => {
        if (!manga) return;
        await resetLibraryCoverToDefault(dispatch, manga);
    }, [manga, dispatch]);

    /** Context menu for the library manga folder (same entries as gallery grid). */
    const handleLibraryRootContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items: [
                    {
                        ...window.contextMenu.template.openInNewWindow(mangaLink),
                        disabled: pathMissing,
                    },
                    {
                        ...window.contextMenu.template.showInExplorer(mangaLink),
                        disabled: pathMissing,
                    },
                    window.contextMenu.template.copyPath(mangaLink),
                    window.contextMenu.template.divider(),
                    {
                        label: isFavourite
                            ? t("gallery.details.removeFavourite")
                            : t("gallery.details.addFavourite"),
                        action() {
                            dispatch(setLibraryItemFavourite({ link: mangaLink, favourite: !isFavourite }));
                        },
                    },
                    {
                        label: t("gallery.details.editMetadata"),
                        action() {
                            setMetadataEditorOpen(true);
                        },
                    },
                    {
                        label: t("shared.resetCover"),
                        disabled: pathMissing,
                        action() {
                            void handleResetCover();
                        },
                    },
                    window.contextMenu.template.divider(),
                    window.contextMenu.template.removeProgress(mangaLink),
                    window.contextMenu.template.removeHistory(mangaLink, false, onClose),
                ],
                focusBackElem: e.currentTarget,
            });
        },
        [mangaLink, onClose, pathMissing, setContextMenuData, isFavourite, t, dispatch, handleResetCover],
    );

    const handleContinueReading = useCallback(() => {
        if (pathMissing || !manga) return;
        if (manga.progress?.itemLink && manga.progress.chapterName) {
            openInReader(resolveMangaChapterPath(manga.progress.itemLink, manga.progress.chapterName), {
                mangaPageNumber: manga.progress.currentPage || 0,
            });
            return;
        }
        void (async () => {
            const startPath = await resolveMangaStartPath(mangaLink);
            if (startPath) await openInReader(startPath);
        })();
    }, [manga, mangaLink, openInReader, pathMissing]);

    const coverArtSrc = manga ? resolveDetailsCoverSrc(manga, tracker?.media?.coverImage) : "";
    const trackerCoverAvailable = Boolean(tracker?.media?.coverImage?.trim());
    const title = manga?.title || t("gallery.details.unknownManga");
    const mangaProgress = manga?.type === "manga" ? manga.progress : null;
    const currentChapterLink =
        mangaProgress?.itemLink && mangaProgress.chapterName
            ? resolveMangaChapterPath(mangaProgress.itemLink, mangaProgress.chapterName)
            : "";

    /**
     * Scrolls the Content list to the in-progress chapter (reader sidelist locate).
     * Uses {@link scrollChildInContainer} so the hero / meta block does not jump.
     */
    const handleLocateCurrentChapter = () => {
        const list = chaptersListRef.current;
        if (!currentChapterLink || !list) return;
        list.querySelectorAll("[data-url]").forEach((elem) => {
            if (elem.getAttribute("data-url") === currentChapterLink && elem instanceof HTMLElement) {
                scrollChildInContainer(list, elem, "center");
            }
        });
    };

    const tabBar = (
        <DetailsTabBar
            tabs={[
                { id: "content", label: t("gallery.details.content"), icon: faBookOpen },
                { id: "bookmarks", label: t("gallery.details.bookmarks"), icon: faBookmark },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            ariaLabel={t("gallery.details.tabsAria")}
        />
    );

    return (
        <div className="manga-details-panel">
            {pathMissing && manga ? (
                <MissingLibraryPathPanel
                    type="manga"
                    link={mangaLink}
                    title={manga.title}
                    onRelocated={(newLink) => onRelocated?.(newLink)}
                    onRemoved={onClose}
                />
            ) : null}
            <DetailsMetaBlock>
                <DetailsHero
                    title={resolved?.title || title}
                    originalTitle={resolved?.originalTitle}
                    author={resolved?.author ?? manga?.author}
                    coverSrc={coverArtSrc}
                    coverAlt={resolved?.title || manga?.title || t("gallery.details.coverAlt")}
                    trackerCoverAvailable={Boolean(manga) && trackerCoverAvailable}
                    coverSource={parseDetailsCoverSource(manga?.extra, tracker?.media?.coverImage)}
                    onCoverSourceChange={
                        manga
                            ? (source) => {
                                  void dispatch(setLibraryItemDetailsCoverSource({ link: mangaLink, source }));
                              }
                            : undefined
                    }
                    onBack={onClose}
                    onCoverContextMenu={handleLibraryRootContextMenu}
                    description={resolved?.description}
                    genres={resolved?.genres}
                    trackerMedia={
                        resolved
                            ? {
                                  status: resolved.mediaStatus,
                                  score: resolved.mediaScore,
                                  totalChapters: resolved.totalChapters,
                                  format: resolved.mediaFormat,
                              }
                            : null
                    }
                    tags={<ItemTagsRow itemLink={mangaLink} />}
                    actions={
                        pathMissing || !manga ? null : (
                            <>
                                <button
                                    type="button"
                                    className="continue-reading"
                                    ref={continueRef}
                                    onClick={handleContinueReading}
                                >
                                    {mangaProgress ? t("shared.continueReading") : t("shared.startReading")}
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() =>
                                        void dispatch(
                                            setLibraryItemFavourite({
                                                link: mangaLink,
                                                favourite: !isFavourite,
                                            }),
                                        )
                                    }
                                    aria-label={
                                        isFavourite
                                            ? t("gallery.details.removeFavourite")
                                            : t("gallery.details.addFavourite")
                                    }
                                    data-tooltip={
                                        isFavourite
                                            ? t("gallery.details.removeFavourite")
                                            : t("gallery.details.addFavourite")
                                    }
                                >
                                    <FontAwesomeIcon icon={isFavourite ? faStar : faStarRegular} />
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() => setMetadataEditorOpen(true)}
                                    aria-label={t("gallery.details.editMetadata")}
                                    data-tooltip={t("gallery.details.editMetadata")}
                                >
                                    <FontAwesomeIcon icon={faPen} />
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() => void handleSelectCover()}
                                    aria-label={t("shared.selectCover")}
                                    data-tooltip={t("shared.selectCover")}
                                >
                                    <FontAwesomeIcon icon={faImage} />
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() => void handleResetCover()}
                                    aria-label={t("shared.resetCover")}
                                    data-tooltip={t("shared.resetCover")}
                                >
                                    <FontAwesomeIcon icon={faSyncAlt} />
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() => window.electron.showItemInFolder(mangaLink)}
                                    aria-label={tCommon("contextMenu.showInExplorer")}
                                    data-tooltip={tCommon("contextMenu.showInExplorer")}
                                >
                                    <FontAwesomeIcon icon={faFolderOpen} />
                                </button>
                                <DetailsCopyPathButton path={mangaLink} />
                                {anilistToken ? (
                                    <AnilistBar
                                        variant="compact"
                                        localLibraryLink={mangaLink}
                                        libraryTitle={resolved?.title ?? manga.title}
                                    />
                                ) : null}
                            </>
                        )
                    }
                    facts={
                        <>
                            {mangaProgress ? (
                                <DetailsFactField label={t("gallery.details.currentChapter")}>
                                    {formatUtils.files.getName(mangaProgress.chapterName || "")}
                                </DetailsFactField>
                            ) : null}
                            <div className="details-pair-row">
                                {mangaProgress ? (
                                    <>
                                        <DetailsFactField label={t("gallery.details.lastRead")}>
                                            {dateUtils.format(mangaProgress.lastReadAt, {
                                                format: dateUtils.presets.dateTime,
                                            })}
                                        </DetailsFactField>
                                        <DetailsFactField label={t("gallery.details.currentPage")}>
                                            {mangaProgress.currentPage} / {mangaProgress.totalPages || "?"}
                                        </DetailsFactField>
                                    </>
                                ) : null}
                                <DetailsFactField label={t("gallery.details.chaptersRead")}>
                                    {`${mangaProgress?.chaptersRead.length ?? 0} / ${chapters.length}`}
                                </DetailsFactField>
                            </div>
                        </>
                    }
                    note={
                        <DetailsItemNote
                            value={itemNote}
                            onChange={setItemNote}
                            onCommit={() => {
                                void dispatch(setLibraryItemNote({ link: mangaLink, note: itemNote }));
                            }}
                        />
                    }
                />
            </DetailsMetaBlock>

            <div className="details-stage">
                {activeTab === "content" ? (
                    <ListNavigator.Provider
                        items={sortedChapters}
                        filterFn={filterChapter}
                        renderItem={renderChapterItem}
                        onContextMenu={handleContextMenu}
                        onSelect={handleSelect}
                        onFilteredItemsChange={(items) =>
                            chapterSelection.setVisibleOrder(items.map((c) => c.name))
                        }
                        emptyMessage={t("gallery.details.noChapters")}
                    >
                        <DetailsListToolbar
                            tabBar={tabBar}
                            selection={
                                chapterSelection.isSelectionMode ? (
                                    <ListSelectionToolbar
                                        count={chapterSelection.count}
                                        onSelectAll={chapterSelection.selectAll}
                                        onInvertSelection={chapterSelection.invertSelection}
                                        onCancel={chapterSelection.clearSelection}
                                        extraMenuItems={[
                                            {
                                                label: t("gallery.details.markAsRead", {
                                                    count: chapterSelection.count,
                                                }),
                                                action: () => handleBulkMarkChapters(true),
                                            },
                                            {
                                                label: t("gallery.details.markAsUnread", {
                                                    count: chapterSelection.count,
                                                }),
                                                action: () => handleBulkMarkChapters(false),
                                            },
                                        ]}
                                    />
                                ) : undefined
                            }
                            search={
                                <ListNavigator.SearchInput
                                    placeholder={t("gallery.details.searchChapters")}
                                    autoFocus={false}
                                    pageSearch={{
                                        id: "gallery-manga-chapters",
                                        priority: PAGE_SEARCH_PRIORITY.details,
                                    }}
                                />
                            }
                            actions={
                                <>
                                    <button
                                        type="button"
                                        data-tooltip={t("gallery.details.locateCurrentChapter")}
                                        aria-label={t("gallery.details.locateCurrentChapter")}
                                        disabled={!currentChapterLink}
                                        onClick={handleLocateCurrentChapter}
                                    >
                                        <FontAwesomeIcon icon={faLocationDot} />
                                    </button>
                                    <button
                                        type="button"
                                        data-tooltip={t("gallery.details.refresh")}
                                        aria-label={t("gallery.details.refresh")}
                                        onClick={refreshChapters}
                                    >
                                        <FontAwesomeIcon icon={faSyncAlt} />
                                    </button>
                                    <button
                                        type="button"
                                        data-tooltip={t("shared.sort.tooltip", {
                                            arrow: sortOrder === "normal" ? "▲ " : "▼ ",
                                            by: sortBy.toUpperCase(),
                                        })}
                                        aria-label={t("shared.sort.tooltip", {
                                            arrow: sortOrder === "normal" ? "▲ " : "▼ ",
                                            by: sortBy.toUpperCase(),
                                        })}
                                        onClick={handleSortClick}
                                    >
                                        <FontAwesomeIcon icon={faSort} />
                                    </button>
                                </>
                            }
                        />
                        <div className="chapters-list" ref={chaptersListRef}>
                            <ListNavigator.List scrollContainerRef={chaptersListRef} />
                        </div>
                    </ListNavigator.Provider>
                ) : (
                    <ListNavigator.Provider
                        items={bookmarksArray}
                        filterFn={filterBookmark}
                        renderItem={renderBookmarkItem}
                        onContextMenu={handleContextMenu}
                        onSelect={handleSelect}
                        onFilteredItemsChange={(items) =>
                            bookmarkSelection.setVisibleOrder(items.map((b) => b.id))
                        }
                        emptyMessage={t("gallery.details.noBookmarksFound")}
                    >
                        <DetailsListToolbar
                            tabBar={tabBar}
                            selection={
                                bookmarkSelection.isSelectionMode ? (
                                    <ListSelectionToolbar
                                        count={bookmarkSelection.count}
                                        onSelectAll={bookmarkSelection.selectAll}
                                        onInvertSelection={bookmarkSelection.invertSelection}
                                        onCancel={bookmarkSelection.clearSelection}
                                        extraMenuItems={[
                                            {
                                                label: t("gallery.details.deleteBookmarksMenu", {
                                                    count: bookmarkSelection.count,
                                                }),
                                                action: handleBulkDeleteBookmarks,
                                            },
                                        ]}
                                    />
                                ) : undefined
                            }
                            search={
                                <ListNavigator.SearchInput
                                    placeholder={t("gallery.details.searchBookmarks")}
                                    autoFocus={false}
                                    pageSearch={{
                                        id: "gallery-manga-bookmarks",
                                        priority: PAGE_SEARCH_PRIORITY.details,
                                    }}
                                />
                            }
                        />
                        <div className="chapters-list" ref={chaptersListRef}>
                            <ListNavigator.List scrollContainerRef={chaptersListRef} />
                        </div>
                    </ListNavigator.Provider>
                )}
            </div>
            {metadataEditorOpen ? (
                <ItemMetadataEditor
                    itemLink={mangaLink}
                    userOverlay={userOverlay}
                    onClose={() => setMetadataEditorOpen(false)}
                />
            ) : null}
        </div>
    );
};

export default MangaDetailsPanel;
