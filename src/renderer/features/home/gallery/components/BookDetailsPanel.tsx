import type { BookBookmark, BookNote, LibraryItemWithProgress } from "@common/types/db";
import AnilistBar from "@features/anilist/AnilistBar";
import { faStar as faStarRegular } from "@fortawesome/free-regular-svg-icons";
import { faBookmark, faFolderOpen, faImage, faPen, faStar, faSyncAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useCycleShortcutGroups } from "@renderer/hooks/useCycleShortcutGroups";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { removeBookmark } from "@store/bookmarks";
import { removeNote } from "@store/bookNotes";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import {
    selectItemMetadata,
    setLibraryItemDetailsCoverSource,
    setLibraryItemFavourite,
    setLibraryItemNote,
} from "@store/library";
import { selectTracker, selectTrackerCoverCacheGeneration } from "@store/trackers";
import { selectModalOverlayOpen } from "@store/ui";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import {
    fileUrlToAbsolutePath,
    hasLocalTrackerCover,
    hasTrackerCoverHint,
    parseDetailsCoverSource,
    resolveDetailsCoverSrc,
} from "@utils/libraryCover";
import { pickAndApplyCustomCover, resetLibraryCoverToDefault } from "@utils/libraryCoverService";
import { resolveItemMetadata } from "@utils/libraryMetadata";
import { createRendererLogger } from "@utils/logger";
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

const log = createRendererLogger("gallery/BookDetailsPanel");

/** Ordered inner-tab ids shared by book details chrome and shortcut cycling. */
const BOOK_DETAILS_TAB_IDS = ["bookmarks", "notes"] as const;

type BookDetailsTabId = (typeof BOOK_DETAILS_TAB_IDS)[number];

type BookDetailsPanelProps = {
    /** Library primary key: path to the `.epub` file */
    bookLink: string;
    onClose: () => void;
    /**
     * Inner tab shown on open. Omit to use this panel's default.
     * Parent remounts the panel (`key` = item link) when the selection changes.
     */
    initialTab?: BookDetailsTabId;
    /** After Locate on disk succeeds, parent should select the new library link. */
    onRelocated?: (newLink: string) => void;
};

/**
 * Gallery details page for a library book: shared hero plus inner list tabs.
 * Opening a bookmark or note launches the reader at the stored chapter and scroll position.
 */
const BookDetailsPanel = ({ bookLink, onClose, onRelocated, initialTab = "bookmarks" }: BookDetailsPanelProps) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const confirmDeleteItem = useAppSelector((store) => store.appSettings.confirmDeleteItem);

    const [activeTab, setActiveTab] = useState<BookDetailsTabId>(initialTab);
    const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);
    const [itemNote, setItemNote] = useState("");

    const book = library[bookLink] as (LibraryItemWithProgress & { type: "book" }) | undefined;
    const overlays = useAppSelector((store) => selectItemMetadata(store, bookLink));
    const tracker = useAppSelector((store) => selectTracker(store, bookLink, "anilist"));
    const coverCacheGeneration = useAppSelector(selectTrackerCoverCacheGeneration);
    const readerActive = useAppSelector((store) => store.reader.active);
    const modalOverlayOpen = useAppSelector(selectModalOverlayOpen);
    const resolved = useMemo(
        () => (book ? resolveItemMetadata({ item: book, overlays, tracker }) : null),
        [book, overlays, tracker],
    );
    const userOverlay = overlays.find((row) => row.source === "user");
    const isFavourite = Boolean(book?.favouritedAt);
    const pathMissing = Boolean(book) && !window.fs.existsSync(bookLink);

    useCycleShortcutGroups(
        {
            bar1: {
                values: BOOK_DETAILS_TAB_IDS,
                current: activeTab,
                onChange: setActiveTab,
            },
        },
        {
            enabled: Boolean(book) && !readerActive && !modalOverlayOpen && !metadataEditorOpen,
        },
    );

    const bookmarksArray = useAppSelector(
        (store) =>
            [...(store.bookmarks.book[bookLink] || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );

    const notesArray = useAppSelector(
        (store) =>
            [...(store.bookNotes.book[bookLink] || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );

    const { setContextMenuData, openInReader } = useAppContext();
    const continueRef = useRef<HTMLButtonElement>(null);
    const detailsListScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        continueRef.current?.focus();
    }, []);

    useEffect(() => {
        setItemNote(book?.note ?? "");
    }, [book?.note]);

    const bookmarkSourceIds = useMemo(() => bookmarksArray.map((b) => b.id), [bookmarksArray]);
    const noteSourceIds = useMemo(() => notesArray.map((n) => n.id), [notesArray]);
    const bookmarkSelection = useMultiSelect<number>(bookmarkSourceIds);
    const noteSelection = useMultiSelect<number>(noteSourceIds);

    /* clear when the details tab changes; extra dep is a trigger */
    // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection on details tab change
    useEffect(() => {
        bookmarkSelection.clearSelection();
        noteSelection.clearSelection();
    }, [activeTab, bookmarkSelection.clearSelection, noteSelection.clearSelection]);

    /**
     * Opens the reader at the bookmark’s chapter and saved element position.
     */
    const openBookmarkInReader = useCallback(
        (bookmark: BookBookmark) => {
            if (pathMissing) return;
            openInReader(bookLink, {
                epubChapterId: bookmark.chapterId,
                epubElementQueryString: bookmark.position,
            });
        },
        [bookLink, openInReader, pathMissing],
    );

    /**
     * Opens the reader at the note's chapter and scrolls to the highlight anchor.
     */
    const openNoteInReader = useCallback(
        (note: BookNote) => {
            if (pathMissing) return;
            openInReader(bookLink, {
                epubChapterId: note.chapterId,
                epubElementQueryString: `[data-highlight-id="${note.id}"]`,
            });
        },
        [bookLink, openInReader, pathMissing],
    );

    const handleBookmarkContextMenu = useCallback(
        (e: React.MouseEvent, bookmark: BookBookmark) => {
            e.preventDefault();
            e.stopPropagation();
            const items: Menu.ListItem[] = [
                {
                    ...window.contextMenu.template.openInNewWindow(bookmark.itemLink),
                    disabled: pathMissing,
                },
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "book", true),
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

    const handleNoteContextMenu = useCallback(
        (e: React.MouseEvent, note: BookNote) => {
            e.preventDefault();
            e.stopPropagation();

            const runDelete = () => {
                dispatch(removeNote({ itemLink: bookLink, ids: [note.id] }))
                    .unwrap()
                    .catch((err: unknown) => {
                        log.error("removeNote failed", err);
                    });
            };

            const items: Menu.ListItem[] = [
                {
                    label: t("gallery.details.deleteNote"),
                    action() {
                        if (!confirmDeleteItem) {
                            runDelete();
                            return;
                        }
                        dialogUtils
                            .warn({
                                title: t("gallery.details.deleteNote"),
                                message: t("gallery.details.deleteNoteMessage"),
                                noOption: false,
                                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                                defaultId: 0,
                            })
                            .then(({ response }) => {
                                if (!response) return;
                                runDelete();
                            });
                    },
                },
            ];
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [bookLink, confirmDeleteItem, dispatch, setContextMenuData, t, tCommon],
    );

    const renderBookmarkItem = useCallback(
        (bookmark: BookBookmark, _index: number, isSelected: boolean) => {
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
                        openBookmarkInReader(bookmark);
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
                            <span className="bookmark-chapter">{bookmark.chapterName}</span>
                            <span className="bookmark-page">
                                <FontAwesomeIcon icon={faBookmark} />
                            </span>
                        </div>
                        <div className="bookmark-date" title={bookmark.createdAt.toString()}>
                            {dateUtils.format(bookmark.createdAt, {
                                format: dateUtils.presets.dateTime,
                            })}
                        </div>
                        {bookmark.note ? <p className="bookmark-note">{bookmark.note}</p> : null}
                    </div>
                </div>
            );
        },
        [handleBookmarkContextMenu, openBookmarkInReader, bookmarkSelection, pathMissing, t],
    );

    const renderNoteItem = useCallback(
        (note: BookNote, _index: number, isSelected: boolean) => {
            const inSelectionMode = noteSelection.isSelectionMode;
            const isChecked = noteSelection.isSelected(note.id);
            return (
                <div
                    key={note.id}
                    className={`note-item ${isSelected ? "selected" : ""} ${
                        inSelectionMode ? "selectionMode" : ""
                    } ${isChecked ? "multiSelected" : ""} ${pathMissing ? "openDisabled" : ""}`}
                    onClick={(e) => {
                        if (inSelectionMode) {
                            noteSelection.toggleItem(note.id, { shiftKey: e.shiftKey });
                            return;
                        }
                        openNoteInReader(note);
                    }}
                    onContextMenu={(e) => handleNoteContextMenu(e, note)}
                    data-focused={isSelected}
                    data-note-id={note.id}
                >
                    <SelectionCheckbox
                        className="rowSelectCheck"
                        boxClassName="checkBox"
                        checked={isChecked}
                        onToggle={({ shiftKey }) => noteSelection.toggleItem(note.id, { shiftKey })}
                        ariaLabel={t("gallery.details.selectNoteAria", { id: note.id })}
                    />
                    <div className="note-item-row">
                        <span
                            className="note-color-dot"
                            style={{ backgroundColor: note.color === "OPEN_EDIT" ? "transparent" : note.color }}
                        />
                        <div className="note-item-body">
                            <div className="note-item-header">
                                <span className="note-chapter">{note.chapterName}</span>
                                <span className="note-date" title={note.createdAt.toString()}>
                                    {dateUtils.format(note.createdAt, {
                                        format: dateUtils.presets.dateTime,
                                    })}
                                </span>
                            </div>
                            {note.content ? <p className="note-content-text">{note.content}</p> : null}
                            <p className="note-selected-preview" title={note.selectedText}>
                                {note.selectedText}
                            </p>
                        </div>
                    </div>
                </div>
            );
        },
        [handleNoteContextMenu, openNoteInReader, noteSelection, pathMissing, t],
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
                dispatch(removeBookmark({ itemLink: bookLink, type: "book", ids }));
                bookmarkSelection.clearSelection();
            });
    }, [bookmarkSelection, bookLink, dispatch, t, tCommon]);

    const handleBulkDeleteNotes = useCallback(() => {
        const ids = Array.from(noteSelection.selectedIds);
        if (ids.length === 0) return;
        dialogUtils
            .warn({
                title: t("gallery.details.deleteNotesTitle"),
                message: t("gallery.details.deleteNotesMessage", { count: ids.length }),
                noOption: false,
                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                dispatch(removeNote({ itemLink: bookLink, ids }))
                    .unwrap()
                    .catch((err: unknown) => {
                        log.error("removeNote (bulk) failed", err);
                    });
                noteSelection.clearSelection();
            });
    }, [noteSelection, bookLink, dispatch, t, tCommon]);

    useSelectionShortcuts({
        selection: bookmarkSelection,
        enabled: activeTab === "bookmarks",
        onDelete: handleBulkDeleteBookmarks,
    });
    useSelectionShortcuts({
        selection: noteSelection,
        enabled: activeTab === "notes",
        onDelete: handleBulkDeleteNotes,
    });

    const filterBookmark = useCallback((filter: string, bookmark: BookBookmark) => {
        return new RegExp(filter, "ig").test(
            [bookmark.note, bookmark.chapterName, bookmark.position].filter(Boolean).join(" "),
        );
    }, []);

    const filterNote = useCallback((filter: string, note: BookNote) => {
        return new RegExp(filter, "ig").test(
            [note.content, note.chapterName, note.selectedText].filter(Boolean).join(" "),
        );
    }, []);

    const handleContextMenu = useCallback((elem: HTMLElement) => {
        elem.dispatchEvent(window.contextMenu.fakeEvent(elem));
    }, []);

    const handleSelect = useCallback((elem: HTMLElement) => {
        elem.click();
    }, []);

    /** Sets a custom cover image for this library item. */
    const handleSelectCover = useCallback(async () => {
        if (!book) return;
        await pickAndApplyCustomCover({
            dispatch,
            libraryId: book.id,
            link: bookLink,
            defaultPath: window.path.dirname(bookLink),
            errorLogLabel: "BookDetailsPanel cover picker",
        });
    }, [book, bookLink, dispatch]);

    const handleResetCover = useCallback(async () => {
        if (!book) return;
        await resetLibraryCoverToDefault(dispatch, book);
    }, [book, dispatch]);

    const handleContinueReading = useCallback(() => {
        if (pathMissing) return;
        openInReader(
            bookLink,
            book?.progress
                ? {
                      epubChapterId: book.progress.chapterId,
                      epubElementQueryString: book.progress.position,
                  }
                : undefined,
        );
    }, [book, bookLink, openInReader, pathMissing]);

    const coverHint = hasTrackerCoverHint(tracker?.media?.coverImage);
    /* non-empty coverArtSrc is always a file:// URL from a local disk path (see resolveDetailsCoverSrc) */
    const coverArtSrc = useMemo(
        () => (book && book.type === "book" ? resolveDetailsCoverSrc(book, coverHint) : ""),
        [book, coverHint, coverCacheGeneration],
    );

    /** Cover context menu: show the displayed cover file, then the same entries as gallery grid tiles. */
    const handleCoverContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const displayedCoverPath = fileUrlToAbsolutePath(coverArtSrc);
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items: [
                    {
                        label: tCommon("contextMenu.showCoverInExplorer"),
                        disabled: !displayedCoverPath,
                        action() {
                            if (displayedCoverPath) window.electron.showItemInFolder(displayedCoverPath);
                        },
                    },
                    window.contextMenu.template.divider(),
                    {
                        ...window.contextMenu.template.openInNewWindow(bookLink),
                        disabled: pathMissing,
                    },
                    {
                        ...window.contextMenu.template.showInExplorer(bookLink),
                        disabled: pathMissing,
                    },
                    window.contextMenu.template.copyPath(bookLink),
                    window.contextMenu.template.divider(),
                    {
                        label: isFavourite
                            ? t("gallery.details.removeFavourite")
                            : t("gallery.details.addFavourite"),
                        action() {
                            dispatch(setLibraryItemFavourite({ link: bookLink, favourite: !isFavourite }));
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
                    window.contextMenu.template.removeProgress(bookLink),
                    window.contextMenu.template.removeHistory(bookLink, false, onClose),
                ],
                focusBackElem: e.currentTarget,
            });
        },
        [
            coverArtSrc,
            bookLink,
            onClose,
            pathMissing,
            setContextMenuData,
            isFavourite,
            t,
            tCommon,
            dispatch,
            handleResetCover,
        ],
    );

    if (!book || book.type !== "book") {
        return (
            <div className="manga-details-panel">
                <DetailsHero
                    title={t("gallery.details.itemNotFound")}
                    coverSrc=""
                    coverAlt=""
                    onBack={onClose}
                    onCoverContextMenu={(e) => e.preventDefault()}
                />
            </div>
        );
    }

    const trackerCoverAvailable = hasLocalTrackerCover(book.id);

    const tabBar = (
        <DetailsTabBar
            tabs={[
                { id: BOOK_DETAILS_TAB_IDS[0], label: t("gallery.details.bookmarks"), icon: faBookmark },
                { id: BOOK_DETAILS_TAB_IDS[1], label: t("gallery.details.notes"), icon: faPen },
            ]}
            activeId={activeTab}
            onChange={setActiveTab}
            ariaLabel={t("gallery.details.tabsAria")}
        />
    );

    return (
        <div className="manga-details-panel">
            {pathMissing ? (
                <MissingLibraryPathPanel
                    type="book"
                    link={bookLink}
                    title={book.title}
                    onRelocated={(newLink) => onRelocated?.(newLink)}
                    onRemoved={onClose}
                />
            ) : null}
            <DetailsMetaBlock>
                <DetailsHero
                    title={resolved?.title || book.title}
                    originalTitle={resolved?.originalTitle}
                    author={resolved?.author ?? book.author}
                    typeBadge={t("shared.epub")}
                    coverSrc={coverArtSrc}
                    coverAlt={resolved?.title || book.title}
                    trackerCoverAvailable={trackerCoverAvailable}
                    coverSource={parseDetailsCoverSource(book.extra, coverHint)}
                    onCoverSourceChange={(source) => {
                        void dispatch(setLibraryItemDetailsCoverSource({ link: bookLink, source }));
                    }}
                    onBack={onClose}
                    onCoverContextMenu={handleCoverContextMenu}
                    description={resolved?.description}
                    genres={resolved?.genres}
                    tracker={tracker ?? null}
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
                    tags={<ItemTagsRow itemLink={bookLink} />}
                    actions={
                        pathMissing ? null : (
                            <>
                                <button
                                    type="button"
                                    className="continue-reading"
                                    ref={continueRef}
                                    onClick={handleContinueReading}
                                >
                                    {book.progress ? t("shared.continueReading") : t("shared.startReading")}
                                </button>
                                <button
                                    type="button"
                                    className="details-icon-btn"
                                    onClick={() =>
                                        void dispatch(
                                            setLibraryItemFavourite({
                                                link: bookLink,
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
                                    onClick={() => window.electron.showItemInFolder(bookLink)}
                                    aria-label={tCommon("contextMenu.showInExplorer")}
                                    data-tooltip={tCommon("contextMenu.showInExplorer")}
                                >
                                    <FontAwesomeIcon icon={faFolderOpen} />
                                </button>
                                <DetailsCopyPathButton path={bookLink} />
                                <AnilistBar
                                    variant="compact"
                                    localLibraryLink={bookLink}
                                    libraryTitle={resolved?.title ?? book.title}
                                />
                            </>
                        )
                    }
                    facts={
                        book.progress ? (
                            <>
                                <DetailsFactField label={t("gallery.details.currentChapter")}>
                                    {book.progress.chapterName}
                                </DetailsFactField>
                                <div className="details-pair-row">
                                    <DetailsFactField label={t("gallery.details.lastRead")}>
                                        {dateUtils.format(book.progress.lastReadAt, {
                                            format: dateUtils.presets.dateTime,
                                        })}
                                    </DetailsFactField>
                                </div>
                            </>
                        ) : undefined
                    }
                    note={
                        <DetailsItemNote
                            value={itemNote}
                            onChange={setItemNote}
                            onCommit={() => {
                                void dispatch(setLibraryItemNote({ link: bookLink, note: itemNote }));
                            }}
                        />
                    }
                />
            </DetailsMetaBlock>

            <div className="details-stage">
                {activeTab === "bookmarks" ? (
                    <ListNavigator.Provider
                        items={bookmarksArray}
                        filterFn={filterBookmark}
                        renderItem={renderBookmarkItem}
                        onContextMenu={handleContextMenu}
                        onSelect={handleSelect}
                        onFilteredItemsChange={(items) =>
                            bookmarkSelection.setVisibleOrder(items.map((b) => b.id))
                        }
                        emptyMessage={t("gallery.details.noBookmarks")}
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
                                        id: "gallery-book-bookmarks",
                                        priority: PAGE_SEARCH_PRIORITY.details,
                                    }}
                                />
                            }
                        />
                        <div className="chapters-list" ref={detailsListScrollRef}>
                            <ListNavigator.List scrollContainerRef={detailsListScrollRef} />
                        </div>
                    </ListNavigator.Provider>
                ) : (
                    <ListNavigator.Provider
                        items={notesArray}
                        filterFn={filterNote}
                        renderItem={renderNoteItem}
                        onContextMenu={handleContextMenu}
                        onSelect={handleSelect}
                        onFilteredItemsChange={(items) => noteSelection.setVisibleOrder(items.map((n) => n.id))}
                        emptyMessage={t("gallery.details.noNotes")}
                    >
                        <DetailsListToolbar
                            tabBar={tabBar}
                            selection={
                                noteSelection.isSelectionMode ? (
                                    <ListSelectionToolbar
                                        count={noteSelection.count}
                                        onSelectAll={noteSelection.selectAll}
                                        onInvertSelection={noteSelection.invertSelection}
                                        onCancel={noteSelection.clearSelection}
                                        extraMenuItems={[
                                            {
                                                label: t("gallery.details.deleteNotesMenu", {
                                                    count: noteSelection.count,
                                                }),
                                                action: handleBulkDeleteNotes,
                                            },
                                        ]}
                                    />
                                ) : undefined
                            }
                            search={
                                <ListNavigator.SearchInput
                                    placeholder={t("gallery.details.searchNotes")}
                                    autoFocus={false}
                                    pageSearch={{
                                        id: "gallery-book-notes",
                                        priority: PAGE_SEARCH_PRIORITY.details,
                                    }}
                                />
                            }
                        />
                        <div className="chapters-list" ref={detailsListScrollRef}>
                            <ListNavigator.List scrollContainerRef={detailsListScrollRef} />
                        </div>
                    </ListNavigator.Provider>
                )}
            </div>
            {metadataEditorOpen ? (
                <ItemMetadataEditor
                    itemLink={bookLink}
                    userOverlay={userOverlay}
                    onClose={() => setMetadataEditorOpen(false)}
                />
            ) : null}
        </div>
    );
};

export default BookDetailsPanel;
