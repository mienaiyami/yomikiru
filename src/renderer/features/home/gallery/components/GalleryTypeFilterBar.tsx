import { faBook, faImages, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

/** Library item type filter applied on top of the active gallery tab. */
export type GalleryTypeFilterId = "all" | "manga" | "book";

/** Display config for a single type-filter segment (labels resolved via i18n in the bar). */
type TypeFilterConfig = {
    id: GalleryTypeFilterId;
    labelKey: "gallery.typeFilter.all.label" | "gallery.typeFilter.manga.label" | "gallery.typeFilter.book.label";
    titleKey: "gallery.typeFilter.all.title" | "gallery.typeFilter.manga.title" | "gallery.typeFilter.book.title";
    icon: typeof faLayerGroup;
};

/** Segment configs for {@link GalleryTypeFilterBar} (All / Manga/Webcomic / eBook). */
const TYPE_FILTERS: readonly TypeFilterConfig[] = [
    {
        id: "all",
        labelKey: "gallery.typeFilter.all.label",
        titleKey: "gallery.typeFilter.all.title",
        icon: faLayerGroup,
    },
    {
        id: "manga",
        labelKey: "gallery.typeFilter.manga.label",
        titleKey: "gallery.typeFilter.manga.title",
        icon: faImages,
    },
    {
        id: "book",
        labelKey: "gallery.typeFilter.book.label",
        titleKey: "gallery.typeFilter.book.title",
        icon: faBook,
    },
] as const;

/** Props for {@link GalleryTypeFilterBar}. */
export type GalleryTypeFilterBarProps = {
    activeFilter: GalleryTypeFilterId;
    onFilterChange: (filter: GalleryTypeFilterId) => void;
};

/**
 * Segmented control that narrows the gallery grid to a single library item type.
 * Renders after {@link GalleryTabBar} and shares its pill styling.
 */
const GalleryTypeFilterBar: React.FC<GalleryTypeFilterBarProps> = ({ activeFilter, onFilterChange }) => {
    const { t } = useTranslation("home");

    return (
        <nav className="galleryTypeFilterBar" aria-label={t("gallery.typeFilter.ariaLabel")}>
            {TYPE_FILTERS.map((filter) => {
                const label = t(filter.labelKey);
                const title = t(filter.titleKey);
                return (
                    <button
                        key={filter.id}
                        type="button"
                        className={`galleryTab ${activeFilter === filter.id ? "active" : ""}`}
                        data-tooltip={title}
                        onClick={() => onFilterChange(filter.id)}
                        aria-pressed={activeFilter === filter.id}
                        aria-label={`${label}: ${title}`}
                    >
                        <FontAwesomeIcon icon={filter.icon} className="galleryTabIcon" />
                        <span className="galleryTabLabel">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
};

export default GalleryTypeFilterBar;
