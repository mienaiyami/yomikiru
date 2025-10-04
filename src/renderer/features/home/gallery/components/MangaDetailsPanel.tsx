import type { LibraryItemWithProgress, MangaBookmark } from "@common/types/db";
import {
    faArrowLeft,
    faBookmark,
    faEdit,
    faExternalLinkAlt,
    faImage,
    faSave,
    faSort,
    faSyncAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { updateLibraryItem } from "@store/library";
import { formatUtils } from "@utils/file";
import { useCallback, useEffect, useMemo, useState } from "react";
import { shallowEqual } from "react-redux";
import "./mangaDetailsPanel.scss";
import ListNavigator from "@renderer/components/ListNavigator";
import { setAppSettings } from "@store/appSettings";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { findCover } from "@utils/utils";

type MangaDetailsPanelProps = {
    mangaLink: string;
    onClose: () => void;
};

type ChapterData = {
    name: string;
    link: string;
    dateModified: number;
    pages: number;
};

const MangaDetailsPanel: React.FC<MangaDetailsPanelProps> = ({ mangaLink, onClose }) => {
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const anilistToken = useAppSelector((store) => store.anilist.token);

    const [chapters, setChapters] = useState<ChapterData[]>([]);
    const [note, setNote] = useState<string>("");
    const [isEditingNote, setIsEditingNote] = useState(false);
    const [activeTab, setActiveTab] = useState<"content" | "bookmarks">("content");
    const sortBy = useAppSelector((store) => store.appSettings.locationListSortBy);
    const sortOrder = useAppSelector((store) => store.appSettings.locationListSortType);

    const manga = library[mangaLink] as LibraryItemWithProgress & { type: "manga" };
    const bookmarksArray = useAppSelector(
        (store) =>
            [...((manga && store.bookmarks.manga[manga.link]) || [])].sort(
                (b, a) => a.createdAt.getTime() - b.createdAt.getTime(),
            ),
        shallowEqual,
    );
    const { setContextMenuData, openInReader } = useAppContext();

    const placeholderNote = "No description available.";

    useEffect(() => {
        if (manga && window.fs.existsSync(mangaLink) && window.fs.isDir(mangaLink)) {
            const coverImage = findCover(mangaLink);

            if (coverImage || !window.fs.isFile(manga.cover || "")) {
                dispatch(
                    updateLibraryItem({
                        link: mangaLink,
                        cover: coverImage,
                    }),
                );
            }
        }
    }, [mangaLink]);

    useEffect(() => {
        setNote(placeholderNote);

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
                                    dirNames.push({
                                        name: fileName,
                                        link: filePath,
                                        dateModified: stat.mtimeMs,
                                        pages,
                                    });
                                }
                            } catch (error) {
                                console.log(error);
                            }
                        }),
                    );
                    setChapters(dirNames);
                }
            } catch (error) {
                console.error("Error fetching chapters:", error);
            }
        };

        fetchChapters();
    }, [mangaLink, manga]);

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

    const handleChapterClick = useCallback(
        (chapterLink: string) => {
            openInReader(chapterLink);
        },
        [openInReader],
    );

    const handleSaveNote = useCallback(() => {
        if (!manga) return;
        setIsEditingNote(false);
        // todo: update note
    }, [manga, note]);

    const handleChapterContextMenu = useCallback(
        (e: React.MouseEvent, chapterLink: string, chapterName: string) => {
            e.preventDefault();

            const items = [
                window.contextMenu.template.open(chapterLink),
                window.contextMenu.template.openInNewWindow(chapterLink),
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
            items.push(window.contextMenu.template.showInExplorer(chapterLink));

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [mangaLink, manga, setContextMenuData, chapters],
    );

    const handleSortClick = useCallback(
        (e: React.MouseEvent) => {
            const items = [
                {
                    label: "Name",
                    action() {
                        dispatch(setAppSettings({ locationListSortBy: "name" }));
                    },
                    selected: sortBy === "name",
                },
                {
                    label: "Date Modified",
                    action() {
                        dispatch(setAppSettings({ locationListSortBy: "date" }));
                    },
                    selected: sortBy === "date",
                },
                window.contextMenu.template.divider(),
                {
                    label: "Ascending",
                    action() {
                        dispatch(setAppSettings({ locationListSortType: "normal" }));
                    },
                    selected: sortOrder === "normal",
                },
                {
                    label: "Descending",
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
        [sortBy, sortOrder, setContextMenuData],
    );

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
                                    dirNames.push({
                                        name: fileName,
                                        link: filePath,
                                        dateModified: stat.mtimeMs,
                                        pages,
                                    });
                                }
                            } catch (error) {
                                console.log(error);
                            }
                        }),
                    );
                    setChapters(dirNames);
                }
            } catch (error) {
                console.error("Error fetching chapters:", error);
            }
        };

        fetchChapters();
    }, [mangaLink]);

    const filterChapter = useCallback((filter: string, chapter: ChapterData) => {
        return new RegExp(filter, "ig").test(chapter.name);
    }, []);

    const renderChapterItem = useCallback(
        (chapter: ChapterData, _index: number, isSelected: boolean) => {
            const isRead = manga?.type === "manga" && manga.progress?.chaptersRead.includes(chapter.name);
            const isCurrent = manga?.progress?.chapterLink === chapter.link;

            return (
                <div
                    key={chapter.link}
                    className={`chapter-item ${isRead ? "read" : ""} ${isCurrent ? "current" : ""} ${isSelected ? "selected" : ""}`}
                    onClick={() => handleChapterClick(chapter.link)}
                    onContextMenu={(e) => handleChapterContextMenu(e, chapter.link, chapter.name)}
                    data-url={chapter.link}
                    data-focused={isSelected}
                    ref={(node) => {
                        if (node && isSelected) {
                            node.scrollIntoView({ behavior: "instant", block: "nearest" });
                        }
                    }}
                >
                    <span className="chapter-name">{formatUtils.files.getName(chapter.name)}</span>

                    <div className="chapter-meta">
                        {formatUtils.files.test(chapter.name) ? (
                            <code className="file-ext">{formatUtils.files.getExt(chapter.name)}</code>
                        ) : (
                            <span className="page-count">{chapter.pages}</span>
                        )}

                        {/* {isRead && (
                            <span className="read-indicator">
                                <FontAwesomeIcon icon={faEye} />
                            </span>
                        )} */}

                        {isCurrent && (
                            <span className="current-indicator">
                                <FontAwesomeIcon icon={faBookmark} />
                            </span>
                        )}
                    </div>
                </div>
            );
        },
        [manga, handleChapterClick, handleChapterContextMenu],
    );

    const handleBookmarkClick = useCallback(
        (bookmark: MangaBookmark) => {
            if (manga?.progress?.chapterLink === bookmark.link) {
                window.app.scrollToPage(bookmark.page, "smooth");
            } else {
                openInReader(bookmark.link, {
                    mangaPageNumber: bookmark.page,
                });
            }
        },
        [manga, openInReader],
    );

    const handleBookmarkContextMenu = useCallback(
        (e: React.MouseEvent, bookmark: MangaBookmark) => {
            e.preventDefault();
            e.stopPropagation();

            const items: Menu.ListItem[] = [
                window.contextMenu.template.openInNewWindow(bookmark.itemLink),
                window.contextMenu.template.removeBookmark(bookmark.itemLink, bookmark.id, "manga", true),
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

    const renderBookmarkItem = useCallback(
        (bookmark: MangaBookmark, _index: number, isSelected: boolean) => {
            return (
                <div
                    key={bookmark.id}
                    className={`bookmark-item ${isSelected ? "selected" : ""}`}
                    onClick={() => handleBookmarkClick(bookmark)}
                    onContextMenu={(e) => handleBookmarkContextMenu(e, bookmark)}
                    data-focused={isSelected}
                    data-bookmark-id={bookmark.id}
                >
                    <div className="bookmark-content">
                        <div className="bookmark-header">
                            {/* <span className="bookmark-icon">
                                <FontAwesomeIcon icon={faBookmark} />
                            </span> */}
                            <span className="bookmark-chapter">
                                {formatUtils.files.getName(bookmark.chapterName || "")}
                            </span>
                            <span className="bookmark-page">Page {bookmark.page}</span>
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
        [handleBookmarkClick, handleBookmarkContextMenu],
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

    const handleSelectCover = useCallback(async () => {
        if (!manga) return;

        try {
            const result = await dialogUtils.showOpenDialog({
                title: "Select Cover",
                filters: [{ name: "Images", extensions: formatUtils.image.list.map((ext) => ext.slice(1)) }],
                defaultPath: mangaLink,
            });
            if (result) {
                dispatch(updateLibraryItem({ link: mangaLink, cover: result.filePaths[0] }));
            }
        } catch (error) {
            console.error("Error selecting cover:", error);
        }
    }, [manga, mangaLink]);

    return (
        <div className="manga-details-panel">
            <div className="top-bar">
                <button className="back-button" onClick={onClose}>
                    <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <h1 className="manga-title">{manga?.title || "Unknown Manga"}</h1>
            </div>

            <div className="panel-content">
                <div className="left-panel">
                    <div className="manga-meta">
                        <div className="cover-container">
                            {manga?.cover ? (
                                <img
                                    src={manga.cover}
                                    alt={manga.title}
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
                                <span className="info-label">Author</span>
                                <span className="info-value">{manga?.author || "Unknown"}</span>
                            </div>
                            {manga?.type === "manga" && manga.progress && (
                                <>
                                    <div className="info-row">
                                        <span className="info-label">Last read</span>
                                        <span className="info-value">
                                            {formatUtils.files.getName(manga.progress.chapterName || "")}
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Current page</span>
                                        <span className="info-value">
                                            {manga.progress.currentPage} / {manga.progress.totalPages || "?"}
                                        </span>
                                    </div>
                                    <div className="info-row">
                                        <span className="info-label">Chapters read</span>
                                        <span className="info-value">{manga.progress.chaptersRead.length}</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="manga-actions-container">
                        <div className="manga-actions">
                            {manga?.type === "manga" && manga.progress && (
                                <button
                                    className="action-button continue-reading"
                                    onClick={() =>
                                        openInReader(manga?.progress?.chapterLink || "", {
                                            mangaPageNumber: manga?.progress?.currentPage || 0,
                                        })
                                    }
                                >
                                    Continue Reading
                                </button>
                            )}
                            <button className="action-button select-cover" onClick={handleSelectCover}>
                                <FontAwesomeIcon icon={faImage} />
                                <span>Select Cover</span>
                            </button>
                            {isEditingNote ? (
                                <button className="action-button save-note" onClick={handleSaveNote}>
                                    <FontAwesomeIcon icon={faSave} />
                                    <span>Save Note</span>
                                </button>
                            ) : (
                                <button className="action-button edit-note" onClick={() => setIsEditingNote(true)}>
                                    <FontAwesomeIcon icon={faEdit} />
                                    <span>Edit Note (Not implemented)</span>
                                </button>
                            )}
                            {anilistToken && (
                                <button className="action-button track-anilist">
                                    <FontAwesomeIcon icon={faExternalLinkAlt} />
                                    <span>Track with AniList (Not implemented)</span>
                                </button>
                            )}
                        </div>
                        <div className="manga-note">
                            <h3>About</h3>
                            {isEditingNote ? (
                                <textarea
                                    className="note-editor"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    placeholder="Add notes about this manga..."
                                />
                            ) : (
                                <div className="note-text">{note || "No description available."}</div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="right-panel">
                    <div className="panel-tabs">
                        <button
                            className={`tab-button ${activeTab === "content" ? "active" : ""}`}
                            onClick={() => setActiveTab("content")}
                        >
                            Content
                        </button>
                        <button
                            className={`tab-button ${activeTab === "bookmarks" ? "active" : ""}`}
                            onClick={() => setActiveTab("bookmarks")}
                        >
                            Bookmarks
                        </button>
                    </div>

                    {activeTab === "content" && (
                        <>
                            <div className="chapters-header">
                                <h2 className="chapters-title">{chapters.length} Chapters</h2>
                            </div>

                            <ListNavigator.Provider
                                items={sortedChapters}
                                filterFn={filterChapter}
                                renderItem={renderChapterItem}
                                onContextMenu={handleContextMenu}
                                onSelect={handleSelect}
                                emptyMessage="No chapters found"
                            >
                                <div className="chapters-toolbar">
                                    <div className="toolbar-actions">
                                        <button data-tooltip="Refresh" onClick={refreshChapters}>
                                            <FontAwesomeIcon icon={faSyncAlt} />
                                        </button>

                                        <button
                                            data-tooltip={`Sort: ${sortOrder === "normal" ? "▲ " : "▼ "}${sortBy.toUpperCase()}`}
                                            onClick={handleSortClick}
                                        >
                                            <FontAwesomeIcon icon={faSort} />
                                        </button>
                                    </div>
                                    <ListNavigator.SearchInput placeholder="Search chapters..." />
                                </div>

                                <div className="chapters-list">
                                    <ListNavigator.List />
                                </div>
                            </ListNavigator.Provider>
                        </>
                    )}

                    {activeTab === "bookmarks" && (
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
                                emptyMessage="No bookmarks found"
                            >
                                <div className="chapters-toolbar">
                                    <ListNavigator.SearchInput placeholder="Search bookmarks..." />
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

export default MangaDetailsPanel;
