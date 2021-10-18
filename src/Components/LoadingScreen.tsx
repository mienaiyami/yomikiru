import { forwardRef, ReactElement, useContext } from "react";
import { AppContext } from "../App";

const LoadingScreen = forwardRef((): ReactElement => {
    const { loadingScreenRef, isLoadingManga } = useContext(AppContext);
    //!remove loadingScreenRef after test
    return (
        <div id="loadingScreen" ref={loadingScreenRef} style={{ display: isLoadingManga ? "grid" : "none" }}>
            <div className="loadingBarCont">
                <div className="loadingbar"></div>
            </div>
        </div>
    );
});

export default LoadingScreen;
