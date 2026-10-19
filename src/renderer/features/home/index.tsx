import "./styles.scss";
import { useAppSelector } from "@store/hooks";
import { useTranslation } from "react-i18next";
import ClassicView from "./classic/ClassicView";
import GalleryView from "./gallery/GalleryView";

const HomeView: React.FC = () => {
    /* kick off lazy `home` namespace load for classic/gallery children */
    useTranslation("home");
    const viewMode = useAppSelector((store) => store.appSettings.homeViewMode);
    const isReaderActive = useAppSelector((store) => store.reader.active);

    return (
        <div
            className="homeContainer"
            style={{
                display: isReaderActive ? "none" : "flex",
            }}
        >
            {viewMode === "classic" ? <ClassicView /> : <GalleryView />}
        </div>
    );
};

export default HomeView;
