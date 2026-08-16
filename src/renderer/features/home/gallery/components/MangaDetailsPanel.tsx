import type { LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import AnilistBar from "@features/anilist/AnilistBar";
import { useDirectoryValidator } from "@features/reader/hooks/useDirectoryValidator";
import {
    faArrowLeft,
    faBookmark,
    faEdit,
    faImage,
    faSave,
    faSort,
    faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { setAppSettings } from "@store/appSettings";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateChaptersReadAll } from "@store/library";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { libraryCoverSrc } from "@utils/libraryCover";
import { materializeMangaLibraryThumbnail, pickAndApplyCustomCover } from "@utils/libraryCoverService";
import {
    mangaPageForMissingKind,
    resolveMissingOpenPath,
    shouldOfferLibraryRelocate,
    updateMangaBookmarkChapterFromPath,
} from "@utils/libraryMissingPath";
import { createRendererLogger } from "@utils/logger";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import ListSelectionToolbar from "../../classic/components/ListSelectionToolbar";
import MissingLibraryPathPanel from "./MissingLibraryPathPanel";
import "./mangaDetailsPanel.scss";

const log = createRendererLogger("gallery/MangaDetailsPanel");

type MangaDetailsPanelProps = {
    mangaLink: string;
    onClose: () => void;
    /**
     * Inner tab shown on open. Omit to use `"content"`.
     * Parent remounts the panel (`key` = item link) when the selection changes.
     */
    initialTab?: "content" | "bookmarks";
    /** After Locate on disk succeeds, parent should select the new library link. */
    onRelocated?: (newLink: string) => void;
};

type ChapterData = {
    name: string;
    link: string;
    dateModified: number;
    pages: number;
};

/** Packed archives stay listed (pages not scanned); empty image folders are omitted. */
const isListableMangaChapterChild = (chapter: { name: string; pages: number }): boolean => {
    if (formatUtils.files.test(chapter.name)) return true;
    return chapter.pages > 0;
};

/**
 * Gallery side panel for a library manga: metadata plus inner tabs `"content"` and `"bookmarks"`.
 * Opening a chapter or bookmark launches the reader at the stored location.
 */
const MangaDetailsPanel: React.FC<MangaDetailsPanelProps> = ({
    mangaLink,
    onClose,
    onRelocated,
    initialTab = "content",
}) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const anilistToken = useAppSelector((store) => store.anilist.token);

    const [chapters, setChapters] = useState<ChapterData[]>([]);
    const [note, setNote] = useState<string>("");
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [activeTab, setActiveTab] = useState<"content" | "bookmarks">(initialTab);
    const sortBy = useAppSelector((store) => store.appSettings.locationListSortBy);
    const sortOrder = useAppSelector((store) => store.appSettings.locationListSortType);

    const manga = library[mangaLink] as LibraryItemWithProgress & { type: "manga" };
    const pathMissing = Boolean(manga) && !window.fs.existsSync(mangaLink);
    const bookmarksArray = useAppSelector(
        (store) =>
            [...((manga && store.bookmarks.manga[manga.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );
    const { setContextMenuData, openInReader } = useAppContext();
    const { validateDirectory } = useDirectoryValidator();

    const placeholderNote = t("gallery.details.noDescription");

    useEffect(() => {
        if (!manga?.id || !window.fs.existsSync(mangaLink) || !window.fs.isDir(mangaLink)) return;
        void (async () => {
            try {
                await materializeMangaLibraryThumbnail(dispatch, manga.id, mangaLink, validateDirectory);
            } catch (err) {
                log.error("covers:materialize from details panel failed", err);
            }
        })();
    }, [mangaLink, manga?.id, dispatch, validateDirectory]);

    const refreshChapters = useCallback(() => {
        const fetchChapters = async () => {
            try {
                if (window.fs.existsSync(mangaLink) && window.fs.isDir(mangaLink)) {
                    const files = await window.fs.readdir(mangaLink);
                    const dirNames: ChapterData[] = [];
                    await Promise.all(
                        files.map(async (fileName) => {
                            try {
                                const filePath = window.path.join(mangaLink, fileName);
                                await window.fs.access(filePath, window.fs.constants.R_OK);
                                const stat = await window.fs.stat(filePath);

                                let pages = 0;
                                if (stat.isDir) {
                                    try {
                                        const chapterFiles = await window.fs.readdir(filePath);
                                        pages = chapterFiles.filter((f) => formatUtils.image.test(f)).length;
                                    } catch (err) {
                                        console.error("Error counting pages:", err);
                                    }
                                }

                                if (stat.isFile && formatUtils.image.test(fileName)) {
                                    return;
                                }
                                if (stat.isDir || (stat.isFile && formatUtils.files.test(fileName))) {
                                    const chapter = {
                                        name: fileName,
                                        link: filePath,
                                        dateModified: stat.mtimeMs,
                                        pages,
                                    };
                                    if (isListableMangaChapterChild(chapter)) {
                                        dirNames.push(chapter);
                                    }
                                }
                            } catch (error) {
                                console.log(error);
                            }
                        }),
                    );
                    setChapters(dirNames);
                } else {
                    setChapters([]);
                }
            } catch (error) {
                console.error("Error fetching chapters:", error);
            }
        };

        void fetchChapters();
    }, [mangaLink]);

    useEffect(() => {
        setNote(placeholderNote);
    }, [mangaLink, manga, placeholderNote]);

    useEffect(() => {
        refreshChapters();
    }, [refreshChapters]);

    const sortedChapters = useMemo(() => {
        if (!chapters.length) return [];

        let sorted: ChapterData[];
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

    const handleSaveNote = useCallback(() => {
        if (!manga) return;
        setIsEditingNote(false);
        // todo: update note
    }, [manga, note]);

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

    const filterChapter = useCallback((filter: string, chapter: ChapterData) => {
        return new RegExp(filter, "ig").test(chapter.name);
    }, []);

    const renderChapterItem = useCallback(
        (chapter: ChapterData, _index: number, isSelected: boolean) => {
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
                    ref={(node) => {
                        if (node && isSelected) {
                            node.scrollIntoView({ behavior: "instant", block: "nearest" });
                        }
                    }}
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
                        {formatUtils.files.test(chapter.name) ? (
                            <code className="file-ext">{formatUtils.files.getExt(chapter.name)}</code>
                        ) : (
                            <span className="page-count">{chapter.pages}</span>
                        )}

                        {isCurrent && (
                            <span className="current-indicator">
                                <FontAwesomeIcon icon={faBookmark} />
                            </span>
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

    useSelectionShortcuts({
        selection: chapterSelection,
        enabled: activeTab === "content",
    });
    useSelectionShortcuts({
        selection: bookmarkSelection,
        enabled: activeTab === "bookmarks",
    });

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
                    window.contextMenu.template.removeHistory(mangaLink, false, onClose),
                ],
                focusBackElem: e.currentTarget,
            });
        },
        [mangaLink, onClose, pathMissing, setContextMenuData],
    );

    const coverArtSrc = manga ? libraryCoverSrc(manga) : "";

    return (
        <div className="manga-details-panel">
            <div className="top-bar">
                <button className="back-button" onClick={onClose}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <h1 className="manga-title">{manga?.title || t("gallery.details.unknownManga")}</h1>
            </div>

            <div className="panel-content">
                <div className="left-panel">
                    <div className="manga-meta">
                        <div className="cover-container" onContextMenu={handleLibraryRootContextMenu}>
                            {coverArtSrc ? (
                                <img
                                    src={coverArtSrc}
                                    alt={manga?.title || t("gallery.details.coverAlt")}
                                    className="manga-cover"
                                    draggable={false}
                                />
                            ) : (
                                <div className="cover-placeholder">
                                    <span>{manga?.title?.[0] || "?"}</span>
                                </div>
                            )}
                        </div>
                        <div className="manga-info">
                            <div className="info-row">
                                <span className="info-label">{t("gallery.details.author")}</span>
                                <span className="info-value">{manga?.author || t("shared.unknown")}</span>
                            </div>
                            {manga?.type === "manga" && manga.progress && (
                                <>
                                    <div className="info-row">
                                        <span className="info-label">{t("gallery.details.lastRead")}</span>
                                        <span className="info-value">
                                            {formatUtils.files.getName(manga.progress.chapterName || "")}
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">{t("gallery.details.currentPage")}</span>
                                        <span className="info-value">
                                            {manga.progress.currentPage} / {manga.progress.totalPages || "?"}
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">{t("gallery.details.chaptersRead")}</span>
                                        <span className="info-value">{manga.progress.chaptersRead.length}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="manga-actions-container">
                        {pathMissing && manga ? (
                            <MissingLibraryPathPanel
                                type="manga"
                                link={mangaLink}
                                title={manga.title}
                                onRelocated={(newLink) => onRelocated?.(newLink)}
                                onRemoved={onClose}
                            />
                        ) : (
                            <>
                                {anilistToken && manga ? (
                                    <div className="gallery-anilist-bar">
                                        <AnilistBar localLibraryLink={mangaLink} libraryTitle={manga.title} />
                                    </div>
                                ) : null}
                                <div className="manga-actions">
                                    {manga?.type === "manga" && manga.progress && (
                                        <button
                                            className="action-button continue-reading"
                                            onClick={() => {
                                                const p =
                                                    manga?.progress?.itemLink && manga?.progress?.chapterName
                                                        ? resolveMangaChapterPath(
                                                              manga.progress.itemLink,
                                                              manga.progress.chapterName,
                                                          )
                                                        : "";
                                                openInReader(p, {
                                                    mangaPageNumber: manga?.progress?.currentPage || 0,
                                                });
                                            }}
                                        >
                                            {t("shared.continueReading")}
                                        </button>
                                    )}
                                    <button className="action-button select-cover" onClick={handleSelectCover}>
                                        <FontAwesomeIcon icon={faImage} />
                                        <span>{t("shared.selectCover")}</span>
                                    </button>
                                    {isEditingNote ? (
                                        <button className="action-button save-note" onClick={handleSaveNote}>
                                            <FontAwesomeIcon icon={faSave} />
                                            <span>{t("gallery.details.saveNote")}</span>
                                        </button>
                                    ) : (
                                        <button
                                            className="action-button edit-note"
                                            onClick={() => setIsEditingNote(true)}
                                        >
                                            <FontAwesomeIcon icon={faEdit} />
                                            <span>{t("gallery.details.editNote")}</span>
                                        </button>
                                    )}
                                </div>
                                <div className="manga-note">
                                    <h3>{t("gallery.details.about")}</h3>
                                    {isEditingNote ? (
                                        <textarea
                                            className="note-editor"
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            placeholder={t("gallery.details.notePlaceholder")}
                                        />
                                    ) : (
                                        <div className="note-text">
                                            {note || t("gallery.details.noDescription")}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="right-panel">
                    <div className="panel-tabs">
                        <button
                            className={`tab-button ${activeTab === "content" ? "active" : ""}`}
                            onClick={() => setActiveTab("content")}
                        >
                            {t("gallery.details.content")}
                        </button>
                        <button
                            className={`tab-button ${activeTab === "bookmarks" ? "active" : ""}`}
                            onClick={() => setActiveTab("bookmarks")}
                        >
                            {t("gallery.details.bookmarks")}
                        </button>
                    </div>

                    {activeTab === "content" && (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">
                                    {t("gallery.details.chaptersCount", { count: chapters.length })}
                                </h2>
                            </div>

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
                                {chapterSelection.isSelectionMode ? (
                                    <div className="chapters-toolbar">
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
                                    </div>
                                ) : (
                                    <div className="chapters-toolbar">
                                        <div className="toolbar-actions">
                                            <button
                                                data-tooltip={t("gallery.details.refresh")}
                                                onClick={refreshChapters}
                                            >
                                                <FontAwesomeIcon icon={faSyncAlt} />
                                            </button>

                                            <button
                                                data-tooltip={t("shared.sort.tooltip", {
                                                    arrow: sortOrder === "normal" ? "▲ " : "▼ ",
                                                    by: sortBy.toUpperCase(),
                                                })}
                                                onClick={handleSortClick}
                                            >
                                                <FontAwesomeIcon icon={faSort} />
                                            </button>
                                        </div>
                                        <ListNavigator.SearchInput
                                            placeholder={t("gallery.details.searchChapters")}
                                        />
                                    </div>
                                )}

                                <div className="chapters-list">
                                    <ListNavigator.List />
                                </div>
                            </ListNavigator.Provider>
                        </>
                    )}

                    {activeTab === "bookmarks" && (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">
                                    {t("gallery.details.bookmarksCount", { count: bookmarksArray.length })}
                                </h2>
                            </div>

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
                                {bookmarkSelection.isSelectionMode ? (
                                    <div className="chapters-toolbar">
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
                                    </div>
                                ) : (
                                    <div className="chapters-toolbar">
                                        <ListNavigator.SearchInput
                                            placeholder={t("gallery.details.searchBookmarks")}
                                        />
                                    </div>
                                )}

                                <div className="chapters-list">
                                    <ListNavigator.List />
                                </div>
                            </ListNavigator.Provider>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MangaDetailsPanel;
