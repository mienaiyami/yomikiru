import { useAppSelector } from "../store/hooks";

const LoadingScreen = () => {
    const isLoadingManga = useAppSelector((store) => store.isLoadingManga);
    const loadingMangaPercent = useAppSelector((store) => store.loadingMangaPercent);
    const unzipping = useAppSelector((store) => store.unzipping);
    return (
        <div id="loadingScreen" style={{ display: isLoadingManga || unzipping ? "grid" : "none" }}>
            {/* <div className="name">
                ({mangaInReader?.pages}) {mangaInReader?.mangaName} - {mangaInReader?.chapterName}
            </div> */}
            {unzipping ? (
                <div className="unzipping">Unzipping and Loading</div>
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
