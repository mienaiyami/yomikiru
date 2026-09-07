import { faEye, faEyeSlash, faLayerGroup } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { GalleryTrackingFilter } from "@utils/gallerySort";
import { useTranslation } from "react-i18next";

/** States for the compact gallery tracking control, keyed by the persisted filter. */
const TRACKING_FILTERS = {
    all: {
        next: "tracked",
        icon: faLayerGroup,
        ariaLabelKey: "gallery.trackingFilter.all.ariaLabel" as const,
        tooltipKey: "gallery.trackingFilter.all.tooltip" as const,
    },
    tracked: {
        next: "untracked",
        icon: faEye,
        ariaLabelKey: "gallery.trackingFilter.tracked.ariaLabel" as const,
        tooltipKey: "gallery.trackingFilter.tracked.tooltip" as const,
    },
    untracked: {
        next: "all",
        icon: faEyeSlash,
        ariaLabelKey: "gallery.trackingFilter.untracked.ariaLabel" as const,
        tooltipKey: "gallery.trackingFilter.untracked.tooltip" as const,
    },
} satisfies Record<
    GalleryTrackingFilter,
    {
        next: GalleryTrackingFilter;
        icon: typeof faLayerGroup;
        ariaLabelKey: `gallery.trackingFilter.${GalleryTrackingFilter}.ariaLabel`;
        tooltipKey: `gallery.trackingFilter.${GalleryTrackingFilter}.tooltip`;
    }
>;

/** Props for {@link GalleryTrackingFilterBar}. */
export type GalleryTrackingFilterBarProps = {
    /** Current persisted gallery tracking filter. */
    trackingFilter: GalleryTrackingFilter;
    /** Persists the next gallery tracking filter. */
    onFilterChange: (trackingFilter: GalleryTrackingFilter) => void;
};

/**
 * Compact three-state filter for AniList tracker membership in gallery results.
 * The parent only renders it while an AniList session is available.
 */
const GalleryTrackingFilterBar: React.FC<GalleryTrackingFilterBarProps> = ({ trackingFilter, onFilterChange }) => {
    const { t } = useTranslation("home");
    const activeFilter = TRACKING_FILTERS[trackingFilter];

    return (
        <nav className="galleryTrackingFilterBar" aria-label={t("gallery.trackingFilter.ariaLabel")}>
            <button
                type="button"
                className={`galleryTrackingFilterButton ${trackingFilter !== "all" ? "active" : ""}`}
                data-tooltip={t(activeFilter.tooltipKey)}
                aria-label={t(activeFilter.ariaLabelKey)}
                aria-pressed={trackingFilter !== "all"}
                onClick={() => onFilterChange(activeFilter.next)}
            >
                <FontAwesomeIcon icon={activeFilter.icon} aria-hidden />
            </button>
        </nav>
    );
};

export default GalleryTrackingFilterBar;
