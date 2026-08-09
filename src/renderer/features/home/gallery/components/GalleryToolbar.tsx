import {
    faCheck,
    faEllipsisV,
    faGrip,
    faSort,
    faTableCellsLarge,
    faTimes,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import ListNavigator from "@renderer/components/ListNavigator";
import InputRange from "@renderer/components/ui/InputRange";
import Popover from "@renderer/components/ui/Popover";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import GalleryTabBar, { type GalleryTabId } from "./GalleryTabBar";
import GalleryTypeFilterBar, { type GalleryTypeFilterId } from "./GalleryTypeFilterBar";

export type { GalleryTabId, GalleryTypeFilterId };

/** Min / max for the gallery item width control (em). */
const GALLERY_ITEM_WIDTH_MIN = 10;
const GALLERY_ITEM_WIDTH_MAX = 30;
const GALLERY_ITEM_WIDTH_STEP = 1;

const GalleryDisplayModeLabel: Record<AppSettings["galleryDisplayMode"], string> = {
    normal: "Normal",
    "cover-only": "Cover Only",
    compact: "Compact",
    list: "List",
} as const;

/** Props for {@link GalleryToolbar}. */
export type GalleryToolbarProps = {
    /** Currently active tab. Determines which sort options are shown. */
    activeTab: GalleryTabId;
    /** Switch home section (Continue / Library / Favourites). */
    onTabChange: (tab: GalleryTabId) => void;
    /** Currently active library item type filter. */
    activeTypeFilter: GalleryTypeFilterId;
    /** Narrow the grid to a single item type (All / Manga / eBook). */
    onTypeFilterChange: (filter: GalleryTypeFilterId) => void;
    /** Hide search input — used by tabs that don't expose filtering yet. */
    hideSearch?: boolean;
    /** When `true`, the entire toolbar collapses (e.g. while a details panel is open). */
    hidden?: boolean;
    /** Selection-mode props. When provided, toolbar swaps to the selection layout. */
    selection?: GalleryToolbarSelectionProps;
};

/** Selection-mode toolbar configuration. */
export type GalleryToolbarSelectionProps = {
    /** Number of currently selected items. */
    count: number;
    /** Replace selection with all visible items. */
    onSelectAll: () => void;
    /** Invert selection across all visible items. */
    onInvertSelection: () => void;
    /** Cancel selection mode (clear all). */
    onCancel: () => void;
    /** Extra menu items shown under the 3-dot button (tab-specific bulk actions). */
    extraMenuItems?: Menu.ListItem[];
};

/**
 * Top chrome for the gallery home: section tabs, type filter, search, and view controls.
 * When `selection` is provided, swaps to a compact selection toolbar with bulk actions.
 *
 * Must be rendered inside a {@link ListNavigator} provider so
 * {@link ListNavigator.SearchInput} can wire up correctly.
 */
const GalleryToolbar: React.FC<GalleryToolbarProps> = ({
    activeTab,
    onTabChange,
    activeTypeFilter,
    onTypeFilterChange,
    hideSearch,
    hidden,
    selection,
}) => {
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((store) => store.appSettings);
    const { setContextMenuData } = useAppContext();

    const handleSortClick = (e: React.MouseEvent) => {
        const items: Menu.ListItem[] =
            activeTab === "continue-reading"
                ? [
                      {
                          label: "Last Read",
                          action: () => dispatch(setAppSettings({ continueReadingSortBy: "lastRead" })),
                          selected: appSettings.continueReadingSortBy === "lastRead",
                      },
                      {
                          label: "Title",
                          action: () => dispatch(setAppSettings({ continueReadingSortBy: "name" })),
                          selected: appSettings.continueReadingSortBy === "name",
                      },
                      window.contextMenu.template.divider(),
                      {
                          label: "Ascending",
                          action: () => dispatch(setAppSettings({ continueReadingSortType: "normal" })),
                          selected: appSettings.continueReadingSortType === "normal",
                      },
                      {
                          label: "Descending",
                          action: () => dispatch(setAppSettings({ continueReadingSortType: "inverse" })),
                          selected: appSettings.continueReadingSortType === "inverse",
                      },
                  ]
                : [
                      {
                          label: "Title",
                          action: () => dispatch(setAppSettings({ gallerySortBy: "name" })),
                          selected: appSettings.gallerySortBy === "name",
                      },
                      {
                          label: "Last Read",
                          action: () => dispatch(setAppSettings({ gallerySortBy: "lastRead" })),
                          selected: appSettings.gallerySortBy === "lastRead",
                      },
                      {
                          label: "Date Modified",
                          action: () => dispatch(setAppSettings({ gallerySortBy: "date" })),
                          selected: appSettings.gallerySortBy === "date",
                      },
                      window.contextMenu.template.divider(),
                      {
                          label: "Ascending",
                          action: () => dispatch(setAppSettings({ gallerySortType: "normal" })),
                          selected: appSettings.gallerySortType === "normal",
                      },
                      {
                          label: "Descending",
                          action: () => dispatch(setAppSettings({ gallerySortType: "inverse" })),
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
    };

    const handleViewClick = (e: React.MouseEvent) => {
        const items: Menu.ListItem[] = [
            {
                label: "Cover + Title",
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "normal" })),
                selected: appSettings.galleryDisplayMode === "normal",
            },
            {
                label: "Cover Only",
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "cover-only" })),
                selected: appSettings.galleryDisplayMode === "cover-only",
            },
            {
                label: "Compact",
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "compact" })),
                selected: appSettings.galleryDisplayMode === "compact",
            },
            {
                label: "List",
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "list" })),
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
    };

    const handleGridSizeSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = Math.min(
            GALLERY_ITEM_WIDTH_MAX,
            Math.max(GALLERY_ITEM_WIDTH_MIN, e.currentTarget.valueAsNumber),
        );
        if (next === appSettings.galleryItemWidth) return next;
        dispatch(setAppSettings({ galleryItemWidth: next }));
        return next;
    };

    const handleMoreMenuClick = (e: React.MouseEvent) => {
        if (!selection) return;
        const items: Menu.ListItem[] = [
            ...(selection.extraMenuItems ?? []),
            ...(selection.extraMenuItems?.length ? [window.contextMenu.template.divider()] : []),
            {
                label: "Invert Selection",
                action: selection.onInvertSelection,
            },
            {
                label: "Clear Selection",
                action: selection.onCancel,
            },
        ];
        setContextMenuData({
            clickX: e.currentTarget.getBoundingClientRect().x,
            clickY: e.currentTarget.getBoundingClientRect().bottom + 4,
            padLeft: true,
            items,
            focusBackElem: e.currentTarget,
        });
    };

    if (selection) {
        return (
            <div className={`galleryToolbar selection ${hidden ? "hidden" : ""}`}>
                <div className="selectionInfo">
                    <button
                        className="selectionCancel"
                        data-tooltip="Cancel selection"
                        onClick={selection.onCancel}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <span className="selectionCount">{selection.count} selected</span>
                </div>
                <div className="selectionActions">
                    <button data-tooltip="Select All" onClick={selection.onSelectAll}>
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button data-tooltip="Invert Selection" onClick={selection.onInvertSelection}>
                        <FontAwesomeIcon icon={faSort} rotation={90} />
                    </button>
                    <button data-tooltip="More" onClick={handleMoreMenuClick}>
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                </div>
            </div>
        );
    }

    const sortBy =
        activeTab === "continue-reading" ? appSettings.continueReadingSortBy : appSettings.gallerySortBy;
    const sortType =
        activeTab === "continue-reading" ? appSettings.continueReadingSortType : appSettings.gallerySortType;

    return (
        <div className={`galleryToolbar ${hidden ? "hidden" : ""}`}>
            <GalleryTabBar activeTab={activeTab} onTabChange={onTabChange} />
            <span className="toolbarDivider" aria-hidden="true" />
            <GalleryTypeFilterBar activeFilter={activeTypeFilter} onFilterChange={onTypeFilterChange} />
            <div className="search">
                {!hideSearch && <ListNavigator.SearchInput placeholder="Type to Search" />}
            </div>
            <div className="actions">
                <button
                    data-tooltip={`Sort: ${sortType === "normal" ? "▲ " : "▼ "}${sortBy.toUpperCase()}`}
                    onClick={handleSortClick}
                >
                    <FontAwesomeIcon icon={faSort} />
                </button>
                <button
                    data-tooltip={`View: ${GalleryDisplayModeLabel[appSettings.galleryDisplayMode]}`}
                    onClick={handleViewClick}
                >
                    <FontAwesomeIcon icon={faGrip} />
                </button>
                <Popover
                    label="Grid size"
                    align="end"
                    placement="bottom"
                    className="gridSizePopover"
                    trigger={({ ref, toggle, ariaProps }) => (
                        <button
                            type="button"
                            ref={ref as React.RefCallback<HTMLButtonElement>}
                            className="gridSizeTrigger"
                            data-tooltip={`Grid size: ${appSettings.galleryItemWidth}em`}
                            onClick={toggle}
                            {...ariaProps}
                        >
                            <FontAwesomeIcon icon={faTableCellsLarge} />
                        </button>
                    )}
                >
                    <div className="gridSizePopoverHeader">
                        <span>Grid size</span>
                        <span className="gridSizeValue">{appSettings.galleryItemWidth}em</span>
                    </div>
                    <InputRange
                        min={GALLERY_ITEM_WIDTH_MIN}
                        max={GALLERY_ITEM_WIDTH_MAX}
                        step={GALLERY_ITEM_WIDTH_STEP}
                        value={appSettings.galleryItemWidth}
                        onChange={handleGridSizeSliderChange}
                        className="gridSizeSlider"
                    />
                    <div className="gridSizeBounds">
                        <span>{GALLERY_ITEM_WIDTH_MIN}</span>
                        <span>{GALLERY_ITEM_WIDTH_MAX}</span>
                    </div>
                </Popover>
            </div>
        </div>
    );
};

export default GalleryToolbar;
