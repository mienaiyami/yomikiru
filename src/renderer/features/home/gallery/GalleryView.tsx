import type { LibraryItemWithProgress } from "@common/types/db";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { useResizeObserverRafWidth } from "@renderer/hooks/useResizeObserverRafWidth";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { setGalleryTrackContext } from "@store/anilist";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem } from "@store/library";
import { setAnilistSearchOpen } from "@store/ui";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { sortContinueReadingItems, sortGalleryItems } from "@utils/gallerySort";
import { libraryCoverSrc } from "@utils/libraryCover";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import ListNavigator from "../../../components/ListNavigator";
import BookDetailsPanel from "./components/BookDetailsPanel";
import GalleryToolbar, { type GalleryTabId, type GalleryTypeFilterId } from "./components/GalleryToolbar";
import MangaDetailsPanel from "./components/MangaDetailsPanel";

const GalleryView: React.FC = () => {
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const appSettings = useAppSelector((store) => store.appSettings);
    const anilistToken = useAppSelector((store) => store.anilist.token);
    const { openInReader, setContextMenuData } = useAppContext();

    const [selectedManga, setSelectedManga] = useState<string | null>(null);
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    const [libraryGridRef, containerWidth] = useResizeObserverRafWidth<HTMLDivElement>();

    const activeTab = appSettings.galleryActiveTab;
    const setActiveTab = useCallback(
        (tab: GalleryTabId) => {
            dispatch(setAppSettings({ galleryActiveTab: tab }));
        },
        [dispatch],
    );

    const activeTypeFilter = appSettings.galleryTypeFilter;
    const setActiveTypeFilter = useCallback(
        (filter: GalleryTypeFilterId) => {
            dispatch(setAppSettings({ galleryTypeFilter: filter }));
        },
        [dispatch],
    );

    const rootFontSizePx = useMemo(
        () => Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
        [],
    );

    const galleryColumnCount = useMemo(() => {
        if (appSettings.galleryDisplayMode === "list") return 1;
        if (!containerWidth) return 1;
        const itemWidthPx = appSettings.galleryItemWidth * rootFontSizePx;
        return Math.max(1, Math.floor(containerWidth / itemWidthPx));
    }, [appSettings.galleryDisplayMode, appSettings.galleryItemWidth, containerWidth, rootFontSizePx]);

    const galleryEstimatedRowSize = useMemo(() => {
        if (appSettings.galleryDisplayMode === "list") {
            return 6 * rootFontSizePx;
        }
        if (!containerWidth || !galleryColumnCount) return 300;
        const colWidth = (containerWidth - 32) / galleryColumnCount;
        return colWidth * 1.5 + 48;
    }, [appSettings.galleryDisplayMode, containerWidth, galleryColumnCount, rootFontSizePx]);

    /**
     * Items shown for the active tab. Each tab has its own slice of the library
     * and (for sortable tabs) its own sort settings. The type filter is applied
     * first so it narrows every tab consistently.
     */
    const tabItems = useMemo<LibraryItemWithProgress[]>(() => {
        const all = Object.values(library).filter(
            (item): item is LibraryItemWithProgress =>
                item !== null && (activeTypeFilter === "all" || item.type === activeTypeFilter),
        );

        if (activeTab === "continue-reading") {
            const withProgress = all.filter((item) => Boolean(item.progress));
            return sortContinueReadingItems(
                withProgress,
                appSettings.continueReadingSortBy,
                appSettings.continueReadingSortType,
            );
        }
        if (activeTab === "favourites") {
            // todo: hook up real favourites once the schema lands.
            return [];
        }
        return sortGalleryItems(all, appSettings.gallerySortBy, appSettings.gallerySortType);
    }, [
        library,
        activeTab,
        activeTypeFilter,
        appSettings.continueReadingSortBy,
        appSettings.continueReadingSortType,
        appSettings.gallerySortBy,
        appSettings.gallerySortType,
    ]);

    const tabIds = useMemo(() => tabItems.map((it) => it.link), [tabItems]);
    const selection = useMultiSelect<string>(tabIds);

    useEffect(() => {
        selection.clearSelection();
    }, [activeTab, activeTypeFilter, selection.clearSelection]);

    const handleMangaSelect = useCallback((libraryItem: LibraryItemWithProgress) => {
        if (libraryItem.type === "book") {
            setSelectedBook(libraryItem.link);
            setSelectedManga(null);
        } else {
            setSelectedManga(libraryItem.link);
            setSelectedBook(null);
        }
    }, []);
    const handleContinueReading = useCallback(
        (item: LibraryItemWithProgress) => {
            const mangaTarget =
                item.type === "manga" && item.progress && "chapterName" in item.progress
                    ? resolveMangaChapterPath(item.progress.itemLink, item.progress.chapterName)
                    : "";
            openInReader(
                item.type === "book" ? item.link : mangaTarget,
                item.type === "book"
                    ? {
                          epubElementQueryString: item.progress?.position,
                          epubChapterId: item.progress?.chapterId,
                      }
                    : {
                          mangaPageNumber: item.progress?.currentPage,
                      },
            );
        },
        [openInReader],
    );

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
            if (anilistToken) {
                items.push({
                    label: "Track with AniList…",
                    action() {
                        dispatch(
                            setGalleryTrackContext({
                                link: item.link,
                                title: item.title,
                            }),
                        );
                        dispatch(setAnilistSearchOpen(true));
                    },
                });
            }

            if (activeTab !== "favourites") {
                items.push(
                    window.contextMenu.template.divider(),
                    window.contextMenu.template.removeHistory(item.link),
                );
            }

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [activeTab, anilistToken, dispatch, setContextMenuData, handleContinueReading],
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
            const coverSrc = libraryCoverSrc(item);
            const isChecked = selection.isSelected(item.link);
            const inSelectionMode = selection.isSelectionMode;
            return (
                <div
                    key={item.link}
                    className={`galleryItem ${isSelected ? "selected" : ""} ${
                        inSelectionMode ? "selectionMode" : ""
                    } ${isChecked ? "multiSelected" : ""}`}
                    onClick={(e) => {
                        if (inSelectionMode) {
                            e.preventDefault();
                            e.stopPropagation();
                            selection.toggleItem(item.link, { shiftKey: e.shiftKey });
                            return;
                        }
                        handleMangaSelect(item);
                    }}
                    onContextMenu={(e) => handleContextMenu(item, e)}
                    data-focused={isSelected}
                >
                    {item.type === "book" && <span className="epubBadge">EPUB</span>}
                    <SelectionCheckbox
                        className="galleryCheckbox"
                        boxClassName="checkBox"
                        checked={isChecked}
                        onToggle={({ shiftKey }) => selection.toggleItem(item.link, { shiftKey })}
                        ariaLabel={`Select ${item.title}`}
                    />
                    <div className="coverContainer">
                        {coverSrc ? (
                            <img src={coverSrc} alt={item.title} draggable={false} loading="lazy" />
                        ) : (
                            <div className="blankCover">{item.title[0]}</div>
                        )}
                        {appSettings.galleryDisplayMode === "compact" && (
                            <div className="mangaTitle compact" title={item.title}>
                                <span>{item.title}</span>
                                {/* temp solution coz cant make background opacity work */}
                                <span className="bg"></span>
                            </div>
                        )}
                    </div>

                    {appSettings.galleryDisplayMode !== "cover-only" &&
                        appSettings.galleryDisplayMode !== "compact" && (
                            <div className="mangaTitle" title={item.title}>
                                <span>{item.title}</span>
                                <span className="bg"></span>
                            </div>
                        )}
                    <button
                        className="continueReadingBtn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleContinueReading(item);
                        }}
                        data-tooltip="Continue Reading"
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                    >
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                </div>
            );
        },
        [handleMangaSelect, handleContextMenu, handleContinueReading, appSettings.galleryDisplayMode, selection],
    );

    const handleCloseMangaDetails = useCallback(() => {
        setSelectedManga(null);
        setSelectedBook(null);
    }, []);

    /**
     * Bulk-delete the currently selected library items. Behaviour matches the
     * single-item context menu remove flow, with one confirmation covering the
     * whole batch.
     */
    const handleRemoveSelectedFromLibrary = useCallback(() => {
        const links = Array.from(selection.selectedIds);
        if (links.length === 0) return;
        dialogUtils
            .warn({
                title: "Remove from Library",
                message: `Remove ${links.length} item${links.length === 1 ? "" : "s"} from library? Related bookmarks will also be removed. Files on disk are not deleted.`,
                noOption: false,
                buttons: ["Cancel", "Yes"],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                for (const link of links) {
                    dispatch(deleteLibraryItem({ link }));
                }
                selection.clearSelection();
            });
    }, [dispatch, selection]);

    const detailsOpen = Boolean(selectedManga || selectedBook);
    useSelectionShortcuts({
        selection,
        enabled: !detailsOpen,
    });

    const selectionToolbarProps = selection.isSelectionMode
        ? {
              count: selection.count,
              onSelectAll: selection.selectAll,
              onInvertSelection: selection.invertSelection,
              onCancel: selection.clearSelection,
              extraMenuItems:
                  activeTab === "favourites"
                      ? []
                      : [
                            {
                                label: `Remove ${selection.count} from Library`,
                                action: handleRemoveSelectedFromLibrary,
                            },
                        ],
          }
        : undefined;

    const emptyMessage =
        activeTab === "favourites"
            ? "No favourites yet"
            : activeTab === "continue-reading"
              ? "Nothing in progress"
              : "No items";

    return (
        <div
            className={`galleryView ${detailsOpen ? "details-open" : ""}`}
            style={{ "--galleryItemWidth": `${appSettings.galleryItemWidth}em` }}
        >
            <ListNavigator.Provider
                items={tabItems}
                filterFn={filterManga}
                renderItem={renderMangaItem}
                emptyMessage={emptyMessage}
                onFilteredItemsChange={(items) => selection.setVisibleOrder(items.map((it) => it.link))}
            >
                <GalleryToolbar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    activeTypeFilter={activeTypeFilter}
                    onTypeFilterChange={setActiveTypeFilter}
                    hidden={detailsOpen}
                    hideSearch={activeTab === "favourites"}
                    selection={selectionToolbarProps}
                />

                <div className={`galleryContent ${detailsOpen ? "with-details" : ""}`}>
                    <div className="libraryGrid" ref={libraryGridRef as RefObject<HTMLDivElement>}>
                        <ListNavigator.VirtualList
                            className={`galleryList ${appSettings.galleryDisplayMode === "list" ? "list" : ""}`}
                            scrollContainerRef={libraryGridRef as RefObject<HTMLElement>}
                            estimatedItemSize={galleryEstimatedRowSize}
                            columnCount={galleryColumnCount}
                            rowGapPx={appSettings.galleryDisplayMode === "list" ? 0 : 16}
                            overscan={0}
                        />
                    </div>

                    {selectedManga && (
                        <MangaDetailsPanel
                            mangaLink={selectedManga}
                            onClose={handleCloseMangaDetails}
                            onRelocated={(newLink) => setSelectedManga(newLink)}
                        />
                    )}
                    {selectedBook && (
                        <BookDetailsPanel
                            bookLink={selectedBook}
                            onClose={handleCloseMangaDetails}
                            onRelocated={(newLink) => setSelectedBook(newLink)}
                        />
                    )}
                </div>
            </ListNavigator.Provider>
        </div>
    );
};

export default GalleryView;
