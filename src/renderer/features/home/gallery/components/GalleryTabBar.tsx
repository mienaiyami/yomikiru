import { faBookOpen, faHeart, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useTranslation } from "react-i18next";

/** Active tab in the gallery home view. */
export type GalleryTabId = "continue-reading" | "library" | "favourites";

/** Display config for gallery home section tabs (labels resolved via i18n in the bar). */
type TabConfig = {
    id: GalleryTabId;
    labelKey: "gallery.tabs.continue.label" | "gallery.tabs.library.label" | "gallery.tabs.favourites.label";
    titleKey: "gallery.tabs.continue.title" | "gallery.tabs.library.title" | "gallery.tabs.favourites.title";
    icon: typeof faPlay;
};

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
 * Horizontal section switcher for the gallery home toolbar
 * (Continue / Library / Favourites).
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
