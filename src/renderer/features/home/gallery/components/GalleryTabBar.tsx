import { faBookOpen, faHeart, faPlay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

/** Active tab in the gallery home view. */
export type GalleryTabId = "continue-reading" | "library" | "favourites";

/** Display config for gallery home section tabs. */
type TabConfig = {
    id: GalleryTabId;
    /** Short label shown in the toolbar segment. */
    label: string;
    /** Full name used for tooltips / aria. */
    title: string;
    icon: typeof faPlay;
};

const TABS: readonly TabConfig[] = [
    { id: "continue-reading", label: "Continue", title: "Continue Reading", icon: faPlay },
    { id: "library", label: "Library", title: "Library", icon: faBookOpen },
    { id: "favourites", label: "Favourites", title: "Favourites", icon: faHeart },
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
    return (
        <nav className="galleryTabBar" aria-label="Home sections">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    className={`galleryTab ${activeTab === tab.id ? "active" : ""}`}
                    data-tooltip={tab.title}
                    onClick={() => onTabChange(tab.id)}
                    aria-pressed={activeTab === tab.id}
                    aria-label={tab.title}
                >
                    <FontAwesomeIcon icon={tab.icon} className="galleryTabIcon" />
                    <span className="galleryTabLabel">{tab.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default GalleryTabBar;
