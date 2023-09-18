import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ReactElement, useContext, useState, useEffect } from "react";
import { AppContext } from "../App";
// import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const LocationListItem = ({
    name,
    link,
    inHistory,
    setCurrentLink,
    focused,
}: {
    name: string;
    link: string;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    /**
     * `[0]` - index of manga in history
     * `[1]` - index of chapter in manga chapter read
     */
    inHistory: [number, number];
    /**
     * for keyboard navigation
     */
    focused: boolean;
}): ReactElement => {
    const { openInReader, checkValidFolder, setContextMenuData, contextMenuData } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);
    const [contextMenuFocused, setContextMenuFocused] = useState(false);

    const onClickHandle = (a = true) => {
        if (!window.fs.existsSync(link)) {
            window.dialog.customError({ message: "Directory/File doesn't exist." });
            return;
        }
        if (window.app.formats.files.test(name)) {
            openInReader(link);
            return;
        }
        if (
            appSettings.openDirectlyFromManga &&
            window.path.normalize(window.path.resolve(link + "../../../") + window.path.sep) ===
                window.path.normalize(appSettings.baseDir + window.path.sep)
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

    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    return (
        <li
            className={`${inHistory && inHistory[1] >= 0 ? "alreadyRead" : ""} ${
                contextMenuFocused ? "focused" : ""
            }`}
            data-focused={focused}
            ref={(node) => {
                if (node && focused) node.scrollIntoView({ block: "nearest" });
            }}
        >
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
                        window.contextMenu.template.open(link),
                        window.contextMenu.template.openInNewWindow(link),
                    ];
                    if (inHistory && inHistory[1] >= 0) {
                        items.push(window.contextMenu.template.unreadChapter(...inHistory));
                    }
                    if (inHistory[0] >= 0) items.push(window.contextMenu.template.unreadAllChapter(inHistory[0]));
                    items.push(window.contextMenu.template.showInExplorer(link));
                    items.push(window.contextMenu.template.copyPath(link));
                    setContextMenuFocused(true);
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        items,
                        focusBackElem: e.nativeEvent.relatedTarget,
                    });
                    // showContextMenu({
                    //     e: e.nativeEvent,
                    //     isFile: true,
                    //     link: link,
                    // });
                }}
            >
                <span className="text">{window.app.formats.files.getName(name)}</span>
                {window.app.formats.files.test(name) && (
                    <code className="nonFolder">{window.app.formats.files.getExt(name)}</code>
                )}
            </a>
            {!appSettings.hideOpenArrow && !window.app.formats.files.test(name) && (
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
