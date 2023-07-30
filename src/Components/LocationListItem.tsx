import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext } from "react";
import { AppContext } from "../App";
// import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const LocationListItem = ({
    name,
    link,
    inHistory,
    setCurrentLink,
}: {
    name: string;
    link: string;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    /**
     * `[0]` - index of manga in history
     * `[1]` - index of chapter in manga chapter read
     */
    inHistory: [number, number];
}): ReactElement => {
    const { openInReader, checkValidFolder, setContextMenuData } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);

    const onClickHandle = (a = true) => {
        if (!window.fs.existsSync(link)) {
            window.dialog.customError({ message: "Directory/File doesn't exist." });
            return;
        }
        if (window.app.isSupportedFormat(name)) {
            openInReader(link);
            return;
        }
        if (
            appSettings.openDirectlyFromManga &&
            window.path.normalize(window.path.resolve(link + "../../../") + window.path.sep) ===
                appSettings.baseDir
        ) {
            checkValidFolder(link, (isValid) => {
                if (isValid) {
                    // had to do this coz below code always set it
                    if (a) setCurrentLink(window.path.dirname(link));
                    openInReader(link);
                }
            });
        }
        if (a) setCurrentLink(link);
    };
    return (
        <li className={inHistory && inHistory[1] >= 0 ? "alreadyRead" : ""}>
            <a
                title={name}
                onClick={(e) => {
                    if (appSettings.openOnDblClick) {
                        const elem = e.currentTarget;
                        if (!elem.getAttribute("data-dblClick")) {
                            elem.setAttribute("data-dblClick", "true");
                            setTimeout(() => {
                                if (elem.getAttribute("data-dblClick") === "true") {
                                    elem.removeAttribute("data-dblClick");
                                    onClickHandle();
                                }
                            }, 250);
                        } else {
                            elem.removeAttribute("data-dblClick");
                            openInReader(link);
                        }
                    } else onClickHandle();
                }}
                onContextMenu={(e) => {
                    const items = [
                        window.contextMenuTemplate.open(link),
                        window.contextMenuTemplate.openInNewWindow(link),
                        window.contextMenuTemplate.showInExplorer(link),
                        window.contextMenuTemplate.copyPath(link),
                    ];
                    if (inHistory && inHistory[1] >= 0) {
                        items.push(window.contextMenuTemplate.unreadChapter(...inHistory));
                    }
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
                    });
                    // showContextMenu({
                    //     e: e.nativeEvent,
                    //     isFile: true,
                    //     link: link,
                    // });
                }}
                tabIndex={-1}
            >
                <span className="text">{name.split(" $")[0]}</span>
                {window.app.isSupportedFormat(name) && <code className="nonFolder">{name.split(" $")[1]}</code>}
            </a>
            {!appSettings.hideOpenArrow && !window.app.isSupportedFormat(name) && (
                <button
                    title="Open In Reader"
                    className="open-in-reader-btn"
                    // onFocus={(e) => e.currentTarget.blur()}
                    onClick={() => openInReader(link)}
                    // onclick="makeImg($(this).siblings('a').attr('data-link'))"
                >
                    <FontAwesomeIcon icon={faAngleRight} />
                </button>
            )}
        </li>
    );
};

export default LocationListItem;
