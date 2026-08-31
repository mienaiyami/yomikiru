import type { LibraryTag } from "@common/types/db";
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
import { PAGE_SEARCH_PRIORITY } from "@renderer/hooks/usePageSearchFocus";
import { setAppSettings } from "@store/appSettings";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { useTranslation } from "react-i18next";
import GalleryTabBar, { type GalleryTabId } from "./GalleryTabBar";
import GalleryTagFilterBar, { type GalleryTagFilterSelection } from "./GalleryTagFilterBar";
import GalleryTypeFilterBar, { type GalleryTypeFilterId } from "./GalleryTypeFilterBar";

export type { GalleryTabId, GalleryTagFilterSelection, GalleryTypeFilterId };

/** Clamp range and step for `galleryItemWidth` (em). */
const GALLERY_ITEM_WIDTH_MIN = 10;
const GALLERY_ITEM_WIDTH_MAX = 30;
const GALLERY_ITEM_WIDTH_STEP = 1;

/** Props for {@link GalleryToolbar}. */
export type GalleryToolbarProps = {
    /** Current `galleryActiveTab`. */
    activeTab: GalleryTabId;
    /** Persist a new `galleryActiveTab`. */
    onTabChange: (tab: GalleryTabId) => void;
    /** Current `galleryTypeFilter`. */
    activeTypeFilter: GalleryTypeFilterId;
    /** Persist a new `galleryTypeFilter`. */
    onTypeFilterChange: (filter: GalleryTypeFilterId) => void;
    /** Catalog for the persisted tag filter; the bar hides when empty. */
    tagCatalog: readonly LibraryTag[];
    /** Current decoded `galleryTagFilterIds` (catalog-valid ids only in the parent). */
    tagFilter: GalleryTagFilterSelection;
    /** Persist a new tag filter selection (parent encodes signed ids). */
    onTagFilterChange: (next: GalleryTagFilterSelection) => void;
    /** Hide the search field when the active tab does not query-filter. */
    hideSearch?: boolean;
    /** Hide sort when the active tab does not use `gallerySortBy` / `gallerySortType`. */
    hideSort?: boolean;
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
 * Top chrome for the gallery home: section tabs, type filter, tag filter,
 * search, and view controls.
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
    tagCatalog,
    tagFilter,
    onTagFilterChange,
    hideSearch,
    hideSort,
    hidden,
    selection,
}) => {
    const { t } = useTranslation("home");
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((store) => store.appSettings);
    const { setContextMenuData } = useAppContext();

    const displayModeLabel = (mode: AppSettings["galleryDisplayMode"]): string => {
        switch (mode) {
            case "normal":
                return t("gallery.toolbar.displayMode.normal");
            case "cover-only":
                return t("gallery.toolbar.displayMode.coverOnly");
            case "compact":
                return t("gallery.toolbar.displayMode.compact");
            case "list":
                return t("gallery.toolbar.displayMode.list");
        }
    };

    const handleSortClick = (e: React.MouseEvent) => {
        const items: Menu.ListItem[] = [
            {
                label: t("shared.sort.title"),
                action: () => dispatch(setAppSettings({ gallerySortBy: "name" })),
                selected: appSettings.gallerySortBy === "name",
            },
            {
                label: t("shared.sort.lastRead"),
                action: () => dispatch(setAppSettings({ gallerySortBy: "lastRead" })),
                selected: appSettings.gallerySortBy === "lastRead",
            },
            {
                label: t("shared.sort.dateModified"),
                action: () => dispatch(setAppSettings({ gallerySortBy: "date" })),
                selected: appSettings.gallerySortBy === "date",
            },
            window.contextMenu.template.divider(),
            {
                label: t("shared.sort.ascending"),
                action: () => dispatch(setAppSettings({ gallerySortType: "normal" })),
                selected: appSettings.gallerySortType === "normal",
            },
            {
                label: t("shared.sort.descending"),
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
                label: t("gallery.toolbar.viewMenu.coverAndTitle"),
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "normal" })),
                selected: appSettings.galleryDisplayMode === "normal",
            },
            {
                label: t("gallery.toolbar.viewMenu.coverOnly"),
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "cover-only" })),
                selected: appSettings.galleryDisplayMode === "cover-only",
            },
            {
                label: t("gallery.toolbar.viewMenu.compact"),
                action: () => dispatch(setAppSettings({ galleryDisplayMode: "compact" })),
                selected: appSettings.galleryDisplayMode === "compact",
            },
            {
                label: t("gallery.toolbar.viewMenu.list"),
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
                label: t("shared.selection.invert"),
                action: selection.onInvertSelection,
            },
            {
                label: t("shared.selection.clear"),
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
                        data-tooltip={t("shared.selection.cancel")}
                        onClick={selection.onCancel}
                    >
                        <FontAwesomeIcon icon={faTimes} />
                    </button>
                    <span className="selectionCount">
                        {t("shared.selection.count", { count: selection.count })}
                    </span>
                </div>
                <div className="selectionActions">
                    <button data-tooltip={t("shared.selection.selectAll")} onClick={selection.onSelectAll}>
                        <FontAwesomeIcon icon={faCheck} />
                    </button>
                    <button data-tooltip={t("shared.selection.invert")} onClick={selection.onInvertSelection}>
                        <FontAwesomeIcon icon={faSort} rotation={90} />
                    </button>
                    <button data-tooltip={t("shared.selection.more")} onClick={handleMoreMenuClick}>
                        <FontAwesomeIcon icon={faEllipsisV} />
                    </button>
                </div>
            </div>
        );
    }

    const sortBy = appSettings.gallerySortBy;
    const sortType = appSettings.gallerySortType;

    return (
        <div className={`galleryToolbar ${hidden ? "hidden" : ""}`}>
            <GalleryTabBar activeTab={activeTab} onTabChange={onTabChange} />
            <span className="toolbarDivider" aria-hidden="true" />
            <GalleryTypeFilterBar activeFilter={activeTypeFilter} onFilterChange={onTypeFilterChange} />
            {tagCatalog.length > 0 ? (
                <>
                    <span className="toolbarDivider" aria-hidden="true" />
                    <GalleryTagFilterBar
                        catalog={tagCatalog}
                        tagFilter={tagFilter}
                        onFilterChange={onTagFilterChange}
                    />
                </>
            ) : null}
            <div className="toolbarEnd">
                <div className="actions">
                    {!hideSort && (
                        <button
                            data-tooltip={t("shared.sort.tooltip", {
                                arrow: sortType === "normal" ? "▲ " : "▼ ",
                                by: sortBy.toUpperCase(),
                            })}
                            onClick={handleSortClick}
                        >
                            <FontAwesomeIcon icon={faSort} />
                        </button>
                    )}
                    <button
                        data-tooltip={t("gallery.toolbar.viewTooltip", {
                            mode: displayModeLabel(appSettings.galleryDisplayMode),
                        })}
                        onClick={handleViewClick}
                    >
                        <FontAwesomeIcon icon={faGrip} />
                    </button>
                    <Popover
                        label={t("gallery.toolbar.gridSize")}
                        align="end"
                        placement="bottom"
                        className="gridSizePopover"
                        trigger={({ ref, toggle, ariaProps }) => (
                            <button
                                type="button"
                                ref={ref as React.RefCallback<HTMLButtonElement>}
                                className="gridSizeTrigger"
                                data-tooltip={t("gallery.toolbar.gridSizeTooltip", {
                                    size: appSettings.galleryItemWidth,
                                })}
                                onClick={toggle}
                                {...ariaProps}
                            >
                                <FontAwesomeIcon icon={faTableCellsLarge} />
                            </button>
                        )}
                    >
                        <div className="gridSizePopoverHeader">
                            <span>{t("gallery.toolbar.gridSize")}</span>
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
                <div className="search">
                    {!hideSearch && (
                        <ListNavigator.SearchInput
                            placeholder={t("gallery.toolbar.searchPlaceholder")}
                            pageSearch={{
                                id: "gallery-toolbar",
                                priority: PAGE_SEARCH_PRIORITY.home,
                                enabled: !hidden,
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default GalleryToolbar;
