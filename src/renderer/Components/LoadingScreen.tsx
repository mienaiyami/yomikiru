import { useAppSelector } from "../store/hooks";

const LoadingScreen = () => {
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    const loadingMangaPercent = useAppSelector((store) => store.loadingMangaPercent);
    const unzipping = useAppSelector((store) => store.unzipping);
    return (
        <div id="loadingScreen" style={{ display: isLoadingManga || unzipping.state ? "grid" : "none" }}>
            {/* <div className="name">
                ({mangaInReader?.pages}) {mangaInReader?.mangaName} - {mangaInReader?.chapterName}
            </div> */}
            {unzipping.state ? (
                <div className="unzipping">{unzipping.text || "EXTRACTING/PROCESSING"}</div>
            ) : (
                <div className="loadingBarCont">
                    <div
                        className="loadingbar"
                        style={{
                            width:
                                Math.floor(loadingMangaPercent) > 100
                                    ? 100
                                    : Math.floor(loadingMangaPercent) + "%",
                        }}
                    ></div>
                </div>
            )}
        </div>
    );
};

export default LoadingScreen;
