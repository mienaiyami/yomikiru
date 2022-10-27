import { ReactElement, useContext } from "react";
import { AppContext } from "../App";

const LoadingScreen = (): ReactElement => {
    const { isLoadingManga, loadingMangaPercent } = useContext(AppContext);
    return (
        <div id="loadingScreen" style={{ display: isLoadingManga ? "grid" : "none" }}>
            {/* <div className="name">
                ({mangaInReader?.pages}) {mangaInReader?.mangaName} - {mangaInReader?.chapterName}
            </div> */}
            <div className="loadingBarCont">
                <div
                    className="loadingbar"
                    style={{
                        width: Math.floor(loadingMangaPercent) > 100 ? 100 : Math.floor(loadingMangaPercent) + "%",
                    }}
                ></div>
            </div>
        </div>
    );
};

export default LoadingScreen;
