import type { BookBookmark, BookNote, LibraryItemWithProgress } from "@common/types/db";
import AnilistBar from "@features/anilist/AnilistBar";
import { faArrowLeft, faBookmark, faImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { removeBookmark } from "@store/bookmarks";
import { removeNote } from "@store/bookNotes";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { libraryCoverSrc } from "@utils/libraryCover";
import { pickAndApplyCustomCover } from "@utils/libraryCoverService";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import ListSelectionToolbar from "../../classic/components/ListSelectionToolbar";
import MissingLibraryPathPanel from "./MissingLibraryPathPanel";
import "./mangaDetailsPanel.scss";

const log = createRendererLogger("gallery/BookDetailsPanel");

type BookDetailsPanelProps = {
    /** Library primary key: path to the `.epub` file */
    bookLink: string;
    onClose: () => void;
    /**
     * Inner tab shown on open. Omit to use `"bookmarks"`.
     * Parent remounts the panel (`key` = item link) when the selection changes.
     */
    initialTab?: "bookmarks" | "notes";
    /** After Locate on disk succeeds, parent should select the new library link. */
    onRelocated?: (newLink: string) => void;
};

/**
 * Gallery side panel for a library book: metadata plus inner tabs `"bookmarks"` and `"notes"`.
 * Opening a bookmark or note launches the reader at the stored chapter and scroll position.
 */
const BookDetailsPanel: React.FC<BookDetailsPanelProps> = ({
    bookLink,
    onClose,
    onRelocated,
    initialTab = "bookmarks",
}) => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const confirmDeleteItem = useAppSelector((store) => store.appSettings.confirmDeleteItem);
    const anilistToken = useAppSelector((store) => store.anilist.token);

    const [activeTab, setActiveTab] = useState<"bookmarks" | "notes">(initialTab);

    const book = library[bookLink] as (LibraryItemWithProgress & { type: "book" }) | undefined;
    const pathMissing = Boolean(book) && !window.fs.existsSync(bookLink);

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

    const bookmarkSourceIds = useMemo(() => bookmarksArray.map((b) => b.id), [bookmarksArray]);
    const noteSourceIds = useMemo(() => notesArray.map((n) => n.id), [notesArray]);
    const bookmarkSelection = useMultiSelect<number>(bookmarkSourceIds);
    const noteSelection = useMultiSelect<number>(noteSourceIds);

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

    useSelectionShortcuts({
        selection: bookmarkSelection,
        enabled: activeTab === "bookmarks",
    });
    useSelectionShortcuts({
        selection: noteSelection,
        enabled: activeTab === "notes",
    });

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

    /** Context menu for the library `.epub` path (same entries as gallery grid). */
    const handleLibraryRootContextMenu = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items: [
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
                    window.contextMenu.template.removeHistory(bookLink, false, onClose),
                ],
                focusBackElem: e.currentTarget,
            });
        },
        [bookLink, onClose, pathMissing, setContextMenuData],
    );

    if (!book || book.type !== "book") {
        return (
            <div className="manga-details-panel">
                <div className="top-bar">
                    <button type="button" className="back-button" onClick={onClose}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <h1 className="manga-title">{t("gallery.details.itemNotFound")}</h1>
                </div>
            </div>
        );
    }

    const coverArtSrc = libraryCoverSrc(book);

    return (
        <div className="manga-details-panel">
            <div className="top-bar">
                <button type="button" className="back-button" onClick={onClose}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <h1 className="manga-title">{book.title}</h1>
            </div>

            <div className="panel-content">
                <div className="left-panel">
                    <div className="manga-meta">
                        <div className="cover-container" onContextMenu={handleLibraryRootContextMenu}>
                            {coverArtSrc ? (
                                <img
                                    src={coverArtSrc}
                                    alt={book.title}
                                    className="manga-cover"
                                    draggable={false}
                                />
                            ) : (
                                <div className="cover-placeholder">
                                    <span>{book.title[0] || "?"}</span>
                                </div>
                            )}
                        </div>
                        <div className="manga-info">
                            <div className="info-row">
                                <span className="info-label">{t("gallery.details.author")}</span>
                                <span className="info-value">{book.author || t("shared.unknown")}</span>
                            </div>
                            {book.progress ? (
                                <>
                                    <div className="info-row">
                                        <span className="info-label">{t("gallery.details.lastRead")}</span>
                                        <span className="info-value">{book.progress.chapterName}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">{t("gallery.details.lastReadAt")}</span>
                                        <span className="info-value">
                                            {dateUtils.format(book.progress.lastReadAt, {
                                                format: dateUtils.presets.dateTime,
                                            })}
                                        </span>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>

                    <div className="manga-actions-container">
                        {pathMissing ? (
                            <MissingLibraryPathPanel
                                type="book"
                                link={bookLink}
                                title={book.title}
                                onRelocated={(newLink) => onRelocated?.(newLink)}
                                onRemoved={onClose}
                            />
                        ) : (
                            <>
                                {anilistToken ? (
                                    <div className="gallery-anilist-bar">
                                        <AnilistBar localLibraryLink={bookLink} libraryTitle={book.title} />
                                    </div>
                                ) : null}
                                <div className="manga-actions">
                                    {book.progress ? (
                                        <button
                                            type="button"
                                            className="action-button continue-reading"
                                            onClick={handleContinueReading}
                                        >
                                            {t("shared.continueReading")}
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="action-button continue-reading"
                                            onClick={handleContinueReading}
                                        >
                                            {t("shared.startReading")}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="action-button select-cover"
                                        onClick={handleSelectCover}
                                    >
                                        <FontAwesomeIcon icon={faImage} />
                                        <span>{t("shared.selectCover")}</span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="right-panel">
                    <div className="panel-tabs">
                        <button
                            type="button"
                            className={`tab-button ${activeTab === "bookmarks" ? "active" : ""}`}
                            onClick={() => setActiveTab("bookmarks")}
                        >
                            {t("gallery.details.bookmarks")}
                        </button>
                        <button
                            type="button"
                            className={`tab-button ${activeTab === "notes" ? "active" : ""}`}
                            onClick={() => setActiveTab("notes")}
                        >
                            {t("gallery.details.notes")}
                        </button>
                    </div>

                    {activeTab === "bookmarks" ? (
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
                                emptyMessage={t("gallery.details.noBookmarks")}
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
                                            pageSearch={{
                                                id: "gallery-book-bookmarks",
                                                priority: PAGE_SEARCH_PRIORITY.details,
                                            }}
                                        />
                                    </div>
                                )}
                                <div className="chapters-list">
                                    <ListNavigator.List />
                                </div>
                            </ListNavigator.Provider>
                        </>
                    ) : (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">
                                    {t("gallery.details.notesCount", { count: notesArray.length })}
                                </h2>
                            </div>
                            <ListNavigator.Provider
                                items={notesArray}
                                filterFn={filterNote}
                                renderItem={renderNoteItem}
                                onContextMenu={handleContextMenu}
                                onSelect={handleSelect}
                                onFilteredItemsChange={(items) =>
                                    noteSelection.setVisibleOrder(items.map((n) => n.id))
                                }
                                emptyMessage={t("gallery.details.noNotes")}
                            >
                                {noteSelection.isSelectionMode ? (
                                    <div className="chapters-toolbar">
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
                                    </div>
                                ) : (
                                    <div className="chapters-toolbar">
                                        <ListNavigator.SearchInput
                                            placeholder={t("gallery.details.searchNotes")}
                                            pageSearch={{
                                                id: "gallery-book-notes",
                                                priority: PAGE_SEARCH_PRIORITY.details,
                                            }}
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

export default BookDetailsPanel;
