import type { LibraryItemWithProgress } from "@common/types/db";
import {
    confirmDeleteProgressForLinks,
    progressLinksFromSelection,
} from "@features/home/classic/listSelectionActions";
import { faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import { ItemDisplayTitle } from "@renderer/components/ItemDisplayTitle";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { useMultiSelect } from "@renderer/hooks/useMultiSelect";
import { focusPrimaryPageSearch } from "@renderer/hooks/usePageSearchFocus";
import { useResizeObserverRafWidth } from "@renderer/hooks/useResizeObserverRafWidth";
import { useSelectionShortcuts } from "@renderer/hooks/useSelectionShortcuts";
import { setGalleryTrackContext } from "@store/anilist";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem, setLibraryItemFavourite } from "@store/library";
import { getShortcutsMapped } from "@store/shortcuts";
import { selectTrackerCoverCacheGeneration } from "@store/trackers";
import { setAnilistSearchOpen } from "@store/ui";
import { confirmWhenMany, dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import {
    selectBookmarkedItems,
    selectFavouritedItems,
    sortContinueReadingItems,
    sortGalleryItems,
} from "@utils/gallerySort";
import { isShortcutEventFromInputTarget, keyFormatter } from "@utils/keybindings";
import { resolveDetailsCoverSrc, trackerCoverHintByItemLink } from "@utils/libraryCover";
import { ensurePdfLibraryCover } from "@utils/libraryCoverService";
import { libraryItemSearchText, resolveAllItemMetadata, trackerByItemLink } from "@utils/libraryMetadata";
import { itemsWithAnyTag } from "@utils/libraryTags";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { resolveMangaStartPath } from "@utils/mangaChapters";
import type { RefObject } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";
import ListNavigator from "../../../components/ListNavigator";
import BookDetailsPanel from "./components/BookDetailsPanel";
import GalleryToolbar, {
    type GalleryTabId,
    type GalleryTagFilterIds,
    type GalleryTypeFilterId,
} from "./components/GalleryToolbar";
import MangaDetailsPanel from "./components/MangaDetailsPanel";

/**
 * When a PDF manga tile has no cover yet, generate page-1 WebP (D2). No visual of its own.
 */
const GalleryPdfCoverKickoff = ({ item, hasCover }: { item: LibraryItemWithProgress; hasCover: boolean }) => {
    const dispatch = useAppDispatch();
    useEffect(() => {
        if (hasCover) return;
        void ensurePdfLibraryCover(dispatch, item);
    }, [dispatch, hasCover, item]);
    return null;
};

/**
 * Gallery home: cover grid for {@link GalleryTabId}, `galleryTypeFilter`,
 * persisted `galleryTagFilterIds`, and a details panel.
 */
const GalleryView: React.FC = () => {
    const { t } = useTranslation("home");
    const { t: tCommon } = useTranslation("common");
    const dispatch = useAppDispatch();
    const library = useAppSelector((store) => store.library.items);
    const metadataByLink = useAppSelector((store) => store.library.metadata);
    const bookmarks = useAppSelector((store) => store.bookmarks);
    const appSettings = useAppSelector((store) => store.appSettings);
    const anilistToken = useAppSelector((store) => store.anilist.token);
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const readerActive = useAppSelector((store) => store.reader.active);
    const detailsDirUpBlocked = useAppSelector((store) => {
        const open = store.ui.isOpen;
        return open.settings || open.anilist.login || open.anilist.search || open.anilist.edit;
    });
    const { openInReader, setContextMenuData } = useAppContext();

    const [selectedManga, setSelectedManga] = useState<string | null>(null);
    const [selectedBook, setSelectedBook] = useState<string | null>(null);
    /** Captured when a tile is opened so switching gallery tabs does not flip the details inner tab. */
    const [detailsInitialTab, setDetailsInitialTab] = useState<"bookmarks" | undefined>();
    const [libraryGridRef, containerWidth] = useResizeObserverRafWidth<HTMLDivElement>();
    const tagCatalog = useAppSelector((store) => store.tags.catalog);
    const tagsHydrated = useAppSelector((store) => store.tags.hydrated);
    const tagAssignments = useAppSelector((store) => store.tags.assignments);
    const trackerEntries = useAppSelector((store) => store.trackers.entries);
    const coverCacheGeneration = useAppSelector(selectTrackerCoverCacheGeneration);
    const trackerCoverHintByLink = useMemo(() => trackerCoverHintByItemLink(trackerEntries), [trackerEntries]);
    const displayByLink = useMemo(() => {
        const items = Object.values(library).filter((item): item is LibraryItemWithProgress => item !== null);
        return resolveAllItemMetadata(items, metadataByLink, trackerByItemLink(trackerEntries));
    }, [library, metadataByLink, trackerEntries]);
    const selectedTagIds = appSettings.galleryTagFilterIds;
    /* drop ids removed from the catalog; memo so toolbar does not see a new array every render */
    const activeTagIds = useMemo(
        () => selectedTagIds.filter((id) => tagCatalog.some((tag) => tag.id === id)),
        [selectedTagIds, tagCatalog],
    );
    /* trust settings until the catalog is loaded; then drop ids for deleted tags */
    const filterTagIds = tagsHydrated ? activeTagIds : selectedTagIds;
    /* stable key for selection-clear effect when the filter membership changes */
    const activeTagFilterKey = filterTagIds
        .slice()
        .sort((a, b) => a - b)
        .join(",");

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

    const setTagFilter = useCallback(
        (tagIds: GalleryTagFilterIds) => {
            dispatch(setAppSettings({ galleryTagFilterIds: [...tagIds] }));
        },
        [dispatch],
    );

    /* drop deleted catalog ids from persisted filter once tags are loaded */
    useEffect(() => {
        if (!tagsHydrated) return;
        if (selectedTagIds.length === activeTagIds.length) return;
        dispatch(setAppSettings({ galleryTagFilterIds: [...activeTagIds] }));
    }, [tagsHydrated, selectedTagIds, activeTagIds, dispatch]);

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
            /* keep in sync with `.galleryList.list .galleryItem` height */
            return 6.6 * rootFontSizePx;
        }
        if (!containerWidth || !galleryColumnCount) return 300;
        const colWidth = (containerWidth - 32) / galleryColumnCount;
        return colWidth * 1.5 + 48;
    }, [appSettings.galleryDisplayMode, containerWidth, galleryColumnCount, rootFontSizePx]);

    /**
     * Library slice for `galleryActiveTab`. `continue-reading` uses a fixed
     * last-read order; `library`, `bookmarks`, and `favourites` use {@link sortGalleryItems}.
     * `galleryTypeFilter` is applied first, then `galleryTagFilterIds` (OR).
     */
    const tabItems = useMemo<LibraryItemWithProgress[]>(() => {
        const typed = Object.values(library).filter(
            (item): item is LibraryItemWithProgress =>
                item !== null && (activeTypeFilter === "all" || item.type === activeTypeFilter),
        );
        const all = filterTagIds.length === 0 ? typed : itemsWithAnyTag(typed, tagAssignments, filterTagIds);
        const titleOf = (item: LibraryItemWithProgress) => displayByLink[item.link]?.title ?? item.title;

        if (activeTab === "continue-reading") {
            return sortContinueReadingItems(all.filter((item) => Boolean(item.progress)));
        }
        if (activeTab === "bookmarks") {
            return sortGalleryItems(
                selectBookmarkedItems(all, bookmarks),
                appSettings.gallerySortBy,
                appSettings.gallerySortType,
                titleOf,
            );
        }
        if (activeTab === "favourites") {
            // membership is selectFavouritedItems; GalleryView RTL would re-test that filter
            return sortGalleryItems(
                selectFavouritedItems(all),
                appSettings.gallerySortBy,
                appSettings.gallerySortType,
                titleOf,
            );
        }
        return sortGalleryItems(all, appSettings.gallerySortBy, appSettings.gallerySortType, titleOf);
    }, [
        library,
        activeTab,
        activeTypeFilter,
        activeTagFilterKey,
        tagAssignments,
        bookmarks,
        appSettings.gallerySortBy,
        appSettings.gallerySortType,
        displayByLink,
    ]);

    const tabIds = useMemo(() => tabItems.map((it) => it.link), [tabItems]);
    const selection = useMultiSelect<string>(tabIds);

    /* clear when the gallery tab or type/tag filter changes; extra deps are triggers */
    // biome-ignore lint/correctness/useExhaustiveDependencies: clear selection on tab/filter change
    useEffect(() => {
        selection.clearSelection();
    }, [activeTab, activeTypeFilter, activeTagFilterKey, selection.clearSelection]);

    /**
     * Open details for a tile. Captures inner tab `"bookmarks"` only when
     * `galleryActiveTab` is `bookmarks` at click time.
     */
    const handleItemSelect = useCallback(
        (libraryItem: LibraryItemWithProgress) => {
            setDetailsInitialTab(activeTab === "bookmarks" ? "bookmarks" : undefined);
            if (libraryItem.type === "book") {
                setSelectedBook(libraryItem.link);
                setSelectedManga(null);
            } else {
                setSelectedManga(libraryItem.link);
                setSelectedBook(null);
            }
        },
        [activeTab],
    );
    const handleContinueReading = useCallback(
        (item: LibraryItemWithProgress) => {
            void (async () => {
                if (item.type === "book") {
                    await openInReader(item.link, {
                        epubElementQueryString: item.progress?.position,
                        epubChapterId: item.progress?.chapterId,
                    });
                    return;
                }
                const mangaTarget = item.progress
                    ? resolveMangaChapterPath(item.progress.itemLink, item.progress.chapterName)
                    : await resolveMangaStartPath(item.link);
                if (!mangaTarget) return;
                await openInReader(mangaTarget, { mangaPageNumber: item.progress?.currentPage });
            })();
        },
        [openInReader],
    );

    const handleContextMenu = useCallback(
        (item: LibraryItemWithProgress, e: React.MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const items: Menu.ListItem[] = [
                {
                    label: t("shared.continueReading"),
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
                    label: t("gallery.trackWithAnilist"),
                    action() {
                        dispatch(
                            setGalleryTrackContext({
                                link: item.link,
                                title: displayByLink[item.link]?.title ?? item.title,
                            }),
                        );
                        dispatch(setAnilistSearchOpen(true));
                    },
                });
            }

            items.push({
                label: item.favouritedAt
                    ? t("gallery.details.removeFavourite")
                    : t("gallery.details.addFavourite"),
                action() {
                    dispatch(setLibraryItemFavourite({ link: item.link, favourite: !item.favouritedAt }));
                },
            });

            items.push(
                window.contextMenu.template.divider(),
                window.contextMenu.template.removeProgress(item.link),
            );
            if (activeTab !== "favourites") {
                items.push(window.contextMenu.template.removeHistory(item.link));
            }

            setContextMenuData({
                clickX: e.clientX,
                clickY: e.clientY,
                items,
                focusBackElem: e.currentTarget,
            });
        },
        [activeTab, anilistToken, dispatch, displayByLink, setContextMenuData, handleContinueReading, t],
    );

    const filterManga = useCallback(
        (filter: string, item: LibraryItemWithProgress) => {
            const titles = displayByLink[item.link]?.searchTitles ?? [item.title];
            const extra =
                item.type === "manga"
                    ? `${
                          formatUtils.mangaFile.test(item.progress?.chapterName || "")
                              ? window.path.extname(item.progress?.chapterName || "")
                              : ""
                      }manga|manhua|manhwa|webtoon|webcomic|comic`
                    : ".epubbook";
            return new RegExp(filter, "ig").test(libraryItemSearchText(titles, extra));
        },
        [displayByLink],
    );

    const renderMangaItem = useCallback(
        (item: LibraryItemWithProgress, _index: number, isSelected: boolean) => {
            const coverSrc = resolveDetailsCoverSrc(item, Boolean(trackerCoverHintByLink[item.link]));
            const isChecked = selection.isSelected(item.link);
            const inSelectionMode = selection.isSelectionMode;
            const display = displayByLink[item.link];
            const primary = display?.title ?? item.title;
            const original = display?.originalTitle;
            const titleLabel = original
                ? t("gallery.details.titleWithOriginal", { title: primary, original })
                : primary;
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
                        handleItemSelect(item);
                    }}
                    onContextMenu={(e) => handleContextMenu(item, e)}
                    data-focused={isSelected}
                >
                    {item.type === "book" && <span className="epubBadge">{t("shared.epub")}</span>}
                    <SelectionCheckbox
                        className="galleryCheckbox"
                        boxClassName="checkBox"
                        checked={isChecked}
                        onToggle={({ shiftKey }) => selection.toggleItem(item.link, { shiftKey })}
                        ariaLabel={t("shared.selectAria", { title: titleLabel })}
                    />
                    <div className="coverContainer">
                        <GalleryPdfCoverKickoff item={item} hasCover={Boolean(coverSrc)} />
                        {coverSrc ? (
                            <img src={coverSrc} alt={titleLabel} draggable={false} loading="lazy" />
                        ) : (
                            <div className="blankCover">{primary[0]}</div>
                        )}
                        {appSettings.galleryDisplayMode === "compact" && (
                            <div className="mangaTitle compact" title={titleLabel}>
                                <span>
                                    <ItemDisplayTitle primary={primary} original={original} />
                                </span>
                                {/* temp solution coz cant make background opacity work */}
                                <span className="bg"></span>
                            </div>
                        )}
                    </div>

                    {appSettings.galleryDisplayMode !== "cover-only" &&
                        appSettings.galleryDisplayMode !== "compact" && (
                            <div className="mangaTitle" title={titleLabel}>
                                <span>
                                    <ItemDisplayTitle primary={primary} original={original} />
                                </span>
                                <span className="bg"></span>
                            </div>
                        )}
                    <button
                        className="continueReadingBtn"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleContinueReading(item);
                        }}
                        data-tooltip={t("shared.continueReading")}
                        tabIndex={-1}
                        onFocus={(e) => e.currentTarget.blur()}
                    >
                        <FontAwesomeIcon icon={faPlay} />
                    </button>
                </div>
            );
        },
        [
            handleItemSelect,
            handleContextMenu,
            handleContinueReading,
            appSettings.galleryDisplayMode,
            selection,
            t,
            trackerCoverHintByLink,
            coverCacheGeneration,
            displayByLink,
        ],
    );

    /**
     * Leaves gallery details and focuses gallery search after the home toolbar is shown.
     */
    const handleCloseMangaDetails = useCallback(() => {
        setSelectedManga(null);
        setSelectedBook(null);
        setDetailsInitialTab(undefined);
        requestAnimationFrame(() => {
            focusPrimaryPageSearch();
        });
    }, []);

    const handleListContextMenu = useCallback((elem: HTMLElement) => {
        elem.dispatchEvent(window.contextMenu.fakeEvent(elem));
    }, []);

    const handleListSelect = useCallback((elem: HTMLElement) => {
        elem.click();
    }, []);

    /**
     * Stars every selected tile. Bulk add is one-click; original spec was hero + tile menu only.
     */
    const handleAddSelectedToFavourites = useCallback(() => {
        const links = Array.from(selection.selectedIds);
        if (links.length === 0) return;
        for (const link of links) {
            dispatch(setLibraryItemFavourite({ link, favourite: true }));
        }
        selection.clearSelection();
    }, [dispatch, selection]);

    /**
     * Clears favourite on the current selection. Confirms when more than one item
     * is selected; a single toggle stays one-click.
     */
    const handleRemoveSelectedFromFavourites = useCallback(() => {
        const links = Array.from(selection.selectedIds);
        if (links.length === 0) return;
        const run = () => {
            for (const link of links) {
                dispatch(setLibraryItemFavourite({ link, favourite: false }));
            }
            selection.clearSelection();
        };
        void confirmWhenMany({
            count: links.length,
            title: t("shared.removeFavourite.title"),
            message: t("shared.removeFavourite.message", { count: links.length }),
            cancelLabel: tCommon("actions.cancel"),
            confirmLabel: tCommon("actions.yes"),
        }).then((ok) => {
            if (!ok) return;
            run();
        });
    }, [dispatch, selection, t, tCommon]);
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
                title: t("shared.removeFromLibrary.title"),
                message: t("shared.removeFromLibrary.message", { count: links.length }),
                noOption: false,
                buttons: [tCommon("actions.cancel"), tCommon("actions.yes")],
                defaultId: 0,
            })
            .then(({ response }) => {
                if (!response) return;
                for (const link of links) {
                    dispatch(deleteLibraryItem({ link }));
                }
                selection.clearSelection();
            });
    }, [dispatch, selection, t, tCommon]);

    /**
     * Drops reading progress for selected titles that have it. Catalogue rows stay.
     */
    const handleRemoveSelectedProgress = useCallback(() => {
        const links = progressLinksFromSelection(library, selection.selectedIds);
        void confirmDeleteProgressForLinks(dispatch, links, {
            onRemoved: selection.clearSelection,
        });
    }, [dispatch, library, selection]);

    const detailsOpen = Boolean(selectedManga || selectedBook);

    useEffect(() => {
        /* Home stays mounted with display:none during the reader; keep this
         * listener off then. After close, window capture still runs when focus
         * is on the TopBar (tree capture on .galleryView did not). */
        if (!detailsOpen || readerActive || detailsDirUpBlocked) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (isShortcutEventFromInputTarget(e)) return;
            const keyStr = keyFormatter(e);
            if (!shortcutsMapped.dirUp.includes(keyStr)) return;
            e.preventDefault();
            e.stopPropagation();
            handleCloseMangaDetails();
        };
        /* capture: details search stopPropagation would skip a bubble listener */
        window.addEventListener("keydown", onKeyDown, true);
        return () => window.removeEventListener("keydown", onKeyDown, true);
    }, [detailsOpen, readerActive, detailsDirUpBlocked, shortcutsMapped, handleCloseMangaDetails]);

    useSelectionShortcuts({
        selection,
        enabled: !detailsOpen,
        onDelete: handleRemoveSelectedFromLibrary,
    });

    const selectedProgressLinks = selection.isSelectionMode
        ? progressLinksFromSelection(library, selection.selectedIds)
        : [];
    const removeProgressMenuItem: Menu.ListItem = {
        label: t("shared.removeProgress.menu", {
            count: selectedProgressLinks.length || selection.count,
        }),
        disabled: selectedProgressLinks.length === 0,
        action: handleRemoveSelectedProgress,
    };

    const selectionToolbarProps = selection.isSelectionMode
        ? {
              count: selection.count,
              onSelectAll: selection.selectAll,
              onInvertSelection: selection.invertSelection,
              onCancel: selection.clearSelection,
              extraMenuItems:
                  activeTab === "favourites"
                      ? [
                            {
                                label: t("shared.removeFavourite.menu", { count: selection.count }),
                                action: handleRemoveSelectedFromFavourites,
                            },
                            removeProgressMenuItem,
                            {
                                label: t("shared.removeFromLibrary.menu", { count: selection.count }),
                                action: handleRemoveSelectedFromLibrary,
                            },
                        ]
                      : [
                            {
                                label: t("shared.addFavourite.menu", { count: selection.count }),
                                action: handleAddSelectedToFavourites,
                            },
                            removeProgressMenuItem,
                            {
                                label: t("shared.removeFromLibrary.menu", { count: selection.count }),
                                action: handleRemoveSelectedFromLibrary,
                            },
                        ],
          }
        : undefined;

    const emptyMessage =
        activeTab === "favourites"
            ? t("gallery.empty.favourites")
            : activeTab === "bookmarks"
              ? t("gallery.empty.bookmarks")
              : activeTab === "continue-reading"
                ? t("gallery.empty.continueReading")
                : tCommon("list.noItems");

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
                onContextMenu={handleListContextMenu}
                onSelect={handleListSelect}
                onFilteredItemsChange={(items) => selection.setVisibleOrder(items.map((it) => it.link))}
            >
                <GalleryToolbar
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    activeTypeFilter={activeTypeFilter}
                    onTypeFilterChange={setActiveTypeFilter}
                    tagCatalog={tagCatalog}
                    selectedTagIds={filterTagIds}
                    onTagFilterChange={setTagFilter}
                    hidden={detailsOpen}
                    hideSort={activeTab === "continue-reading"}
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
                            key={selectedManga}
                            mangaLink={selectedManga}
                            initialTab={detailsInitialTab}
                            onClose={handleCloseMangaDetails}
                            onRelocated={(newLink) => setSelectedManga(newLink)}
                        />
                    )}
                    {selectedBook && (
                        <BookDetailsPanel
                            key={selectedBook}
                            bookLink={selectedBook}
                            initialTab={detailsInitialTab}
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
