import type { LibraryItemWithProgress } from "@common/types/db";
import { faGrip, faPlay, faSort } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { formatUtils } from "@utils/file";
import { useCallback, useMemo, useState } from "react";
import ListNavigator from "../../../components/ListNavigator";
import MangaDetailsPanel from "./components/MangaDetailsPanel";

const GalleryDisplayMode: Record<AppSettings["galleryDisplayMode"], string> = {
    normal: "Normal",
    "cover-only": "Cover Only",
    compact: "Compact",
    list: "List",
} as const;

const GalleryView: React.FC = () => {
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const { openInReader, setContextMenuData } = useAppContext();
    const dispatch = useAppDispatch();

    const [selectedManga, setSelectedManga] = useState<string | null>(null);

    // Convert library object to array for easier manipulation
    const mangaList = useMemo(() => {
        const items = Object.values(library);
        // console.log(items.filter((item) => item?.type === "book").map((item) => item?.cover));

        // Sort the items based on selected criteria
        let sorted: (LibraryItemWithProgress | null)[];
        switch (appSettings.gallerySortBy) {
            case "name":
                sorted = items.sort((a, b) => {
                    if (!a || !b) return 0;
                    return window.app.betterSortOrder(a.title, b.title);
                });
                break;
            case "lastRead":
                sorted = items.sort((a, b) => {
                    const aTime = a?.progress?.lastReadAt.getTime() || 0;
                    const bTime = b?.progress?.lastReadAt.getTime() || 0;
                    return bTime - aTime; // Most recent first
                });
                break;
            case "date":
                // todo:
                sorted = items.sort((a, b) => {
                    const aTime = a?.updatedAt.getTime() || 0;
                    const bTime = b?.updatedAt.getTime() || 0;
                    return bTime - aTime; // Most recent first
                });
                break;
            default:
                sorted = items;
        }
        sorted = sorted.filter((manga) => manga !== null);
        return (
            appSettings.gallerySortType === "inverse" ? sorted.reverse() : sorted
        ) as LibraryItemWithProgress[];
    }, [library, appSettings.gallerySortBy, appSettings.gallerySortType]);

    const handleMangaSelect = useCallback((libraryItem: LibraryItemWithProgress) => {
        if (libraryItem.type === "book") {
            openInReader(libraryItem.link, {
                epubElementQueryString: libraryItem.progress?.position,
                epubChapterId: libraryItem.progress?.chapterId,
            });
        } else {
            setSelectedManga(libraryItem.link);
        }
    }, []);
    const handleContinueReading = useCallback((item: LibraryItemWithProgress) => {
        openInReader(
            item.type === "book" ? item.link : item.progress?.chapterLink || "",
            item.type === "book"
                ? {
                      epubElementQueryString: item.progress?.position,
                      epubChapterId: item.progress?.chapterId,
                  }
                : {
                      mangaPageNumber: item.progress?.currentPage,
                  },
        );
    }, []);

    const handleContextMenu = useCallback(
        (item: LibraryItemWithProgress, e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const items: Menu.ListItem[] = [
                {
                    label: "Continue Reading",
                    action() {
                        handleContinueReading(item);
                    },
                },
                window.contextMenu.template.openInNewWindow(item.link),
                window.contextMenu.template.showInExplorer(item.link),
                window.contextMenu.template.copyPath(item.link),
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

    const filterManga = useCallback((filter: string, item: LibraryItemWithProgress) => {
        const searchText =
            item.type === "manga"
                ? item.title +
                  (formatUtils.files.test(item.progress?.chapterName || "")
                      ? `${window.path.extname(item.progress?.chapterName || "")}`
                      : "") +
                  "manga|manhua|manhwa|webtoon|webcomic|comic"
                : `${item.title}.epubbook`;
        return new RegExp(filter, "ig").test(searchText);
    }, []);

    const renderMangaItem = useCallback(
        (item: LibraryItemWithProgress, _index: number, isSelected: boolean) => {
            return (
                <div
                    key={item.link}
                    className={`galleryItem ${isSelected ? "selected" : ""}`}
                    onClick={() => handleMangaSelect(item)}
                    onContextMenu={(e) => handleContextMenu(item, e)}
                    ref={(node) => {
                        if (node && isSelected) {
                            node.scrollIntoView({ behavior: "smooth", block: "nearest" });
                        }
                    }}
                    data-focused={isSelected}
                >
                    {item.type === "book" && <span className="epubBadge">EPUB</span>}
                    <div className="coverContainer">
                        {item.cover ? (
                            <img src={item.cover} alt={item.title} draggable={false} loading="lazy" />
                        ) : (
                            <div className="blankCover">{item.title[0]}</div>
                        )}
                    </div>

                    {appSettings.galleryDisplayMode !== "cover-only" && (
                        <div
                            className={`mangaTitle ${
                                appSettings.galleryDisplayMode === "compact" ? "compact" : ""
                            }`}
                            title={item.title}
                        >
                            <span>{item.title}</span>
                            {/* temp solution coz cant make background opacity work */}
                            <span className="bg"></span>
                        </div>
                    )}
                    <button
                        className="continueReadingBtn"
                        onClick={() => handleContinueReading(item)}
                        data-tooltip="Continue Reading"
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                    >
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                </div>
            );
        },
        [handleMangaSelect, handleContextMenu, appSettings.galleryDisplayMode],
    );

    const handleSortClick = useCallback(
        (e: React.MouseEvent) => {
            const items = [
                {
                    label: "Title",
                    action() {
                        dispatch(setAppSettings({ gallerySortBy: "name" }));
                    },
                    selected: appSettings.gallerySortBy === "name",
                },
                {
                    label: "Last Read",
                    action() {
                        dispatch(setAppSettings({ gallerySortBy: "lastRead" }));
                    },
                    selected: appSettings.gallerySortBy === "lastRead",
                },
                {
                    label: "Date Modified",
                    action() {
                        dispatch(setAppSettings({ gallerySortBy: "date" }));
                    },
                    selected: appSettings.gallerySortBy === "date",
                },
                window.contextMenu.template.divider(),
                {
                    label: "Ascending",
                    action() {
                        dispatch(setAppSettings({ gallerySortType: "normal" }));
                    },
                    selected: appSettings.gallerySortType === "normal",
                },
                {
                    label: "Descending",
                    action() {
                        dispatch(setAppSettings({ gallerySortType: "inverse" }));
                    },
                    selected: appSettings.gallerySortType === "inverse",
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
        [setContextMenuData, appSettings.gallerySortBy, appSettings.gallerySortType],
    );

    const handleViewClick = useCallback(
        (e: React.MouseEvent) => {
            const items = [
                {
                    label: "Cover + Title",
                    action() {
                        dispatch(setAppSettings({ galleryDisplayMode: "normal" }));
                    },
                    selected: appSettings.galleryDisplayMode === "normal",
                },
                {
                    label: "Cover Only",
                    action() {
                        dispatch(setAppSettings({ galleryDisplayMode: "cover-only" }));
                    },
                    selected: appSettings.galleryDisplayMode === "cover-only",
                },
                {
                    label: "Compact",
                    action() {
                        dispatch(setAppSettings({ galleryDisplayMode: "compact" }));
                    },
                    selected: appSettings.galleryDisplayMode === "compact",
                },
                {
                    label: "List",
                    action() {
                        dispatch(setAppSettings({ galleryDisplayMode: "list" }));
                    },
                    selected: appSettings.galleryDisplayMode === "list",
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
        [setContextMenuData, appSettings.galleryDisplayMode],
    );

    const handleCloseMangaDetails = useCallback(() => {
        setSelectedManga(null);
    }, []);

    return (
        <div className="galleryView" style={{ "--galleryItemWidth": `${appSettings.galleryItemWidth}em` }}>
            <ListNavigator.Provider
                items={mangaList}
                filterFn={filterManga}
                renderItem={renderMangaItem}
                emptyMessage="No items"
            >
                <div className={`galleryToolbar ${selectedManga ? "hidden" : ""}`}>
                    <div>
                        <ListNavigator.SearchInput placeholder="Type to Search" />
                    </div>
                    <div>
                        <button
                            data-tooltip={`Sort: ${appSettings.gallerySortType === "normal" ? "▲ " : "▼ "}${appSettings.gallerySortBy.toUpperCase()}`}
                            onClick={handleSortClick}
                        >
                            <FontAwesomeIcon icon={faSort} />
                        </button>

                        <button
                            data-tooltip={`View: ${GalleryDisplayMode[appSettings.galleryDisplayMode]}`}
                            onClick={handleViewClick}
                        >
                            <FontAwesomeIcon icon={faGrip} />
                        </button>
                    </div>
                </div>

                <div className={`galleryContent ${selectedManga ? "with-details" : ""}`}>
                    <div className="libraryGrid">
                        <ListNavigator.List
                            className={`galleryList ${appSettings.galleryDisplayMode === "list" ? "list" : ""}`}
                        />
                    </div>

                    {selectedManga && (
                        <MangaDetailsPanel mangaLink={selectedManga} onClose={handleCloseMangaDetails} />
                    )}
                </div>
            </ListNavigator.Provider>
        </div>
    );
};

export default GalleryView;
