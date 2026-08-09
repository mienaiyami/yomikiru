import { faBook, faImages, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

/** Library item type filter applied on top of the active gallery tab. */
export type GalleryTypeFilterId = "all" | "manga" | "book";

/** Display config for a single type-filter segment. */
type TypeFilterConfig = {
    id: GalleryTypeFilterId;
    /** Short label shown in the segment. */
    label: string;
    /** Tooltip / aria text spelling out what the filter covers. */
    title: string;
    icon: typeof faLayerGroup;
};

/** Segment configs for {@link GalleryTypeFilterBar} (All / Manga/Webcomic / eBook). */
const TYPE_FILTERS: readonly TypeFilterConfig[] = [
    { id: "all", label: "All", title: "All items in this section", icon: faLayerGroup },
    {
        id: "manga",
        label: "Manga/Webcomic",
        title: "Includes manga, manhwa, manhua, comics, webtoons and other image-based series",
        icon: faImages,
    },
    { id: "book", label: "eBook", title: "Includes EPUB books. PDF is not included.", icon: faBook },
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
    return (
        <nav className="galleryTypeFilterBar" aria-label="Item type filter">
            {TYPE_FILTERS.map((filter) => (
                <button
                    key={filter.id}
                    type="button"
                    className={`galleryTab ${activeFilter === filter.id ? "active" : ""}`}
                    data-tooltip={filter.title}
                    onClick={() => onFilterChange(filter.id)}
                    aria-pressed={activeFilter === filter.id}
                    aria-label={`${filter.label}: ${filter.title}`}
                >
                    <FontAwesomeIcon icon={filter.icon} className="galleryTabIcon" />
                    <span className="galleryTabLabel">{filter.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default GalleryTypeFilterBar;
