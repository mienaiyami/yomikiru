import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import React, {
    forwardRef,
    ReactElement,
    useContext,
    useEffect,
    useState,
} from "react";
import { faGithub } from "@fortawesome/free-brands-svg-icons";
import {
    faHome,
    faCog,
    faMinus,
    faTimes,
} from "@fortawesome/free-solid-svg-icons";
import {
    faWindowMaximize,
    faWindowRestore,
} from "@fortawesome/free-regular-svg-icons";
import { AppContext } from "../App";

const TopBar = forwardRef((props, pageNumberInputRef: any): ReactElement => {
    const [isMaximized, setMaximized] = useState(true);
    useEffect(() => {
        window.electron.ipcRenderer.on("isMaximized", () => {
            setMaximized(true);
        });
        window.electron.ipcRenderer.on("isRestored", () => {
            setMaximized(false);
        });
    }, []);
    const { setSettingOpen } = useContext(AppContext);
    return (
        <div id="topBar">
            <div className="titleDragable"></div>
            <div className="titleBar">
                <button
                    className="home"
                    onClick={() => window.location.reload()}
                    tabIndex={-1}
                    data-tooltip="Home"
                >
                    <FontAwesomeIcon icon={faHome} />
                </button>
                <button
                    className="settingsBtn"
                    onClick={() => {
                        setSettingOpen((state) => !state);
                    }}
                    tabIndex={-1}
                    data-tooltip="Settings"
                >
                    <FontAwesomeIcon icon={faCog} />
                </button>
                <button
                    className="githubbtn"
                    onClick={() =>
                        window.electron.shell.openExternal(
                            "https://github.com/mienaiYami/offline-manga-reader"
                        )
                    }
                    tabIndex={-1}
                    data-tooltip="Github"
                >
                    <FontAwesomeIcon icon={faGithub} />
                </button>
                <div className="title">Manga Reader</div>
            </div>

            <div className="titleBarBtns">
                <label
                    id="pageNumbers"
                    title="Nagivate To Page Number"
                    ref={pageNumberInputRef}
                    htmlFor="NavigateToPageInput"
                    data-tooltip="Navigate To Page Number"
                >
                    <input
                        type="number"
                        title="Nagivate To Page Number"
                        id="NavigateToPageInput"
                        placeholder="Page Num."
                        tabIndex={-1}
                        min="1"
                    />
                    <span className="totalPage">/40</span>
                </label>
                <button
                    tabIndex={-1}
                    id="minimizeBtn"
                    title="Minimize"
                    onClick={() => {
                        window.electron.ipcRenderer.send("minimizeApp");
                    }}
                >
                    <FontAwesomeIcon icon={faMinus} />
                </button>
                <button
                    tabIndex={-1}
                    id="maximizeRestoreBtn"
                    title={isMaximized ? "Restore" : "Maximize"}
                    onClick={() => {
                        window.electron.ipcRenderer.send("maximizeRestoreApp");
                    }}
                >
                    <FontAwesomeIcon
                        icon={isMaximized ? faWindowRestore : faWindowMaximize}
                    />
                </button>
                <button
                    tabIndex={-1}
                    id="closeBtn"
                    title="Close"
                    onClick={() => {
                        window.electron.ipcRenderer.send("closeApp");
                    }}
                >
                    <FontAwesomeIcon icon={faTimes} />
                </button>
            </div>
        </div>
    );
});

export default TopBar;
