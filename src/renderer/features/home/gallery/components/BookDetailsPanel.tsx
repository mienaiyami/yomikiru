import type { BookBookmark, BookNote, LibraryItemWithProgress } from "@common/types/db";
import { faArrowLeft, faBookmark, faImage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import { removeNote } from "@store/bookNotes";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateLibraryItem } from "@store/library";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { createRendererLogger } from "@utils/logger";
import { useCallback, useState } from "react";
import { shallowEqual } from "react-redux";
import "./mangaDetailsPanel.scss";

const log = createRendererLogger("gallery/BookDetailsPanel");

type BookDetailsPanelProps = {
    /** Library primary key: path to the `.epub` file */
    bookLink: string;
    onClose: () => void;
};

/**
 * Gallery side panel for a library book: metadata, bookmarks, and reader notes (highlights).
 * Opening a bookmark or note launches the reader at the stored chapter and scroll position.
 */
const BookDetailsPanel: React.FC<BookDetailsPanelProps> = ({ bookLink, onClose }) => {
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const confirmDeleteItem = useAppSelector((store) => store.appSettings.confirmDeleteItem);

    const [activeTab, setActiveTab] = useState<"bookmarks" | "notes">("bookmarks");

    const book = library[bookLink] as (LibraryItemWithProgress & { type: "book" }) | undefined;

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

    /**
     * Opens the reader at the bookmark’s chapter and saved element position.
     */
    const openBookmarkInReader = useCallback(
        (bookmark: BookBookmark) => {
            openInReader(bookLink, {
                epubChapterId: bookmark.chapterId,
                epubElementQueryString: bookmark.position,
            });
        },
        [bookLink, openInReader],
    );

    /**
     * Opens the reader at the note’s chapter and scrolls to the highlight anchor.
     */
    const openNoteInReader = useCallback(
        (note: BookNote) => {
            openInReader(bookLink, {
                epubChapterId: note.chapterId,
                epubElementQueryString: `[data-highlight-id="${note.id}"]`,
            });
        },
        [bookLink, openInReader],
    );

    const handleBookmarkContextMenu = useCallback(
        (e: React.MouseEvent, bookmark: BookBookmark) => {
            e.preventDefault();
            e.stopPropagation();
            const items: Menu.ListItem[] = [
                window.contextMenu.template.openInNewWindow(bookmark.itemLink),
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "book", true),
            ];
            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [setContextMenuData],
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
                    label: "Delete Note",
                    action() {
                        if (!confirmDeleteItem) {
                            runDelete();
                            return;
                        }
                        dialogUtils
                            .warn({
                                title: "Delete Note",
                                message: "Only this note will be removed. Continue?",
                                noOption: false,
                                buttons: ["Cancel", "Yes"],
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
        [bookLink, confirmDeleteItem, dispatch, setContextMenuData],
    );

    const renderBookmarkItem = useCallback(
        (bookmark: BookBookmark, _index: number, isSelected: boolean) => {
            return (
                <div
                    key={bookmark.id}
                    className={`bookmark-item ${isSelected ? "selected" : ""}`}
                    onClick={() => openBookmarkInReader(bookmark)}
                    onContextMenu={(e) => handleBookmarkContextMenu(e, bookmark)}
                    data-focused={isSelected}
                    data-bookmark-id={bookmark.id}
                >
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
        [handleBookmarkContextMenu, openBookmarkInReader],
    );

    const renderNoteItem = useCallback(
        (note: BookNote, _index: number, isSelected: boolean) => {
            return (
                <div
                    key={note.id}
                    className={`note-item ${isSelected ? "selected" : ""}`}
                    onClick={() => openNoteInReader(note)}
                    onContextMenu={(e) => handleNoteContextMenu(e, note)}
                    data-focused={isSelected}
                    data-note-id={note.id}
                >
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
        [handleNoteContextMenu, openNoteInReader],
    );

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
        try {
            const result = await dialogUtils.showOpenDialog({
                title: "Select Cover",
                filters: [{ name: "Images", extensions: formatUtils.image.list.map((ext) => ext.slice(1)) }],
                defaultPath: window.path.dirname(bookLink),
            });
            if (result) {
                dispatch(updateLibraryItem({ link: bookLink, cover: result.filePaths[0] }));
            }
        } catch (error) {
            log.error("select cover failed", error);
        }
    }, [book, bookLink, dispatch]);

    const handleContinueReading = useCallback(() => {
        if (!book?.progress) return;
        openInReader(bookLink, {
            epubChapterId: book.progress.chapterId,
            epubElementQueryString: book.progress.position,
        });
    }, [book, bookLink, openInReader]);

    if (!book || book.type !== "book") {
        return (
            <div className="manga-details-panel">
                <div className="top-bar">
                    <button type="button" className="back-button" onClick={onClose}>
                        <FontAwesomeIcon icon={faArrowLeft} />
                    </button>
                    <h1 className="manga-title">Item not found</h1>
                </div>
            </div>
        );
    }

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
                        <div className="cover-container">
                            {book.cover ? (
                                <img src={book.cover} alt={book.title} className="manga-cover" draggable={false} />
                            ) : (
                                <div className="cover-placeholder">
                                    <span>{book.title[0] || "?"}</span>
                                </div>
                            )}
                        </div>
                        <div className="manga-info">
                            <div className="info-row">
                                <span className="info-label">Author</span>
                                <span className="info-value">{book.author || "Unknown"}</span>
                            </div>
                            {book.progress ? (
                                <>
                                    <div className="info-row">
                                        <span className="info-label">Last read</span>
                                        <span className="info-value">{book.progress.chapterName}</span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Last read at</span>
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
                        <div className="manga-actions">
                            {book.progress ? (
                                <button
                                    type="button"
                                    className="action-button continue-reading"
                                    onClick={handleContinueReading}
                                >
                                    Continue Reading
                                </button>
                            ) : null}
                            <button
                                type="button"
                                className="action-button select-cover"
                                onClick={handleSelectCover}
                            >
                                <FontAwesomeIcon icon={faImage} />
                                <span>Select Cover</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="panel-tabs">
                        <button
                            type="button"
                            className={`tab-button ${activeTab === "bookmarks" ? "active" : ""}`}
                            onClick={() => setActiveTab("bookmarks")}
                        >
                            Bookmarks
                        </button>
                        <button
                            type="button"
                            className={`tab-button ${activeTab === "notes" ? "active" : ""}`}
                            onClick={() => setActiveTab("notes")}
                        >
                            Notes
                        </button>
                    </div>

                    {activeTab === "bookmarks" ? (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">{bookmarksArray.length} Bookmarks</h2>
                            </div>
                            <ListNavigator.Provider
                                items={bookmarksArray}
                                filterFn={filterBookmark}
                                renderItem={renderBookmarkItem}
                                onContextMenu={handleContextMenu}
                                onSelect={handleSelect}
                                emptyMessage="No bookmarks"
                            >
                                <div className="chapters-toolbar">
                                    <ListNavigator.SearchInput placeholder="Search bookmarks..." />
                                </div>
                                <div className="chapters-list">
                                    <ListNavigator.List />
                                </div>
                            </ListNavigator.Provider>
                        </>
                    ) : (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">{notesArray.length} Notes</h2>
                            </div>
                            <ListNavigator.Provider
                                items={notesArray}
                                filterFn={filterNote}
                                renderItem={renderNoteItem}
                                onContextMenu={handleContextMenu}
                                onSelect={handleSelect}
                                emptyMessage="No notes"
                            >
                                <div className="chapters-toolbar">
                                    <ListNavigator.SearchInput placeholder="Search notes..." />
                                </div>
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
