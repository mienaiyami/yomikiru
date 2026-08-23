import { faBookmark, faBookOpen, faHeart, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

/** Persisted `galleryActiveTab` id. */
export type GalleryTabId = "continue-reading" | "library" | "bookmarks" | "favourites";

/** Display config for gallery home section tabs (labels resolved via i18n in the bar). */
type TabConfig = {
    id: GalleryTabId;
    labelKey:
        | "gallery.tabs.continue.label"
        | "gallery.tabs.library.label"
        | "gallery.tabs.bookmarks.label"
        | "gallery.tabs.favourites.label";
    titleKey:
        | "gallery.tabs.continue.title"
        | "gallery.tabs.library.title"
        | "gallery.tabs.bookmarks.title"
        | "gallery.tabs.favourites.title";
    icon: typeof faPlay;
};

/** Ordered {@link GalleryTabId} entries for the gallery section switcher. */
const TABS: readonly TabConfig[] = [
    {
        id: "continue-reading",
        labelKey: "gallery.tabs.continue.label",
        titleKey: "gallery.tabs.continue.title",
        icon: faPlay,
    },
    {
        id: "library",
        labelKey: "gallery.tabs.library.label",
        titleKey: "gallery.tabs.library.title",
        icon: faBookOpen,
    },
    {
        id: "bookmarks",
        labelKey: "gallery.tabs.bookmarks.label",
        titleKey: "gallery.tabs.bookmarks.title",
        icon: faBookmark,
    },
    {
        id: "favourites",
        labelKey: "gallery.tabs.favourites.label",
        titleKey: "gallery.tabs.favourites.title",
        icon: faHeart,
    },
] as const;

/** Props for {@link GalleryTabBar}. */
export type GalleryTabBarProps = {
    activeTab: GalleryTabId;
    onTabChange: (tab: GalleryTabId) => void;
};

/**
 * Horizontal section switcher for the gallery home toolbar ({@link GalleryTabId}).
 */
const GalleryTabBar: React.FC<GalleryTabBarProps> = ({ activeTab, onTabChange }) => {
    const { t } = useTranslation("home");

    return (
        <nav className="galleryTabBar" aria-label={t("gallery.tabs.ariaLabel")}>
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`galleryTab ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => onTabChange(tab.id)}
                    aria-pressed={activeTab === tab.id}
                    aria-label={t(tab.titleKey)}
                >
                    <FontAwesomeIcon icon={tab.icon} className="galleryTabIcon" />
                    <span className="galleryTabLabel">{t(tab.labelKey)}</span>
                </button>
            ))}
        </nav>
    );
};

export default GalleryTabBar;
