import { useAppSelector } from "@store/hooks";

const LoadingScreen = () => {
    const loading = useAppSelector((store) => store.reader.loading);
    return (
        <div id="loadingScreen" style={{ display: loading ? "grid" : "none" }}>
            {/* <div className="name">
                ({mangaInReader?.pages}) {mangaInReader?.mangaName} - {mangaInReader?.chapterName}
            </div> */}
            {loading && (
                <>
                    <div className="loadingText">{loading.message}</div>
                    {loading.percent !== null && (
                        <div className="loadingBarCont">
                            <div
                                className="loadingBar"
                                style={{
                                    width: loading.percent > 100 ? 100 : loading.percent + "%",
                                }}
                            ></div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LoadingScreen;
