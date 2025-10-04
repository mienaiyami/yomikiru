import "./styles.scss";
import { useAppSelector } from "@store/hooks";
import ClassicView from "./classic/ClassicView";
import GalleryView from "./gallery/GalleryView";

const HomeView: React.FC = () => {
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
