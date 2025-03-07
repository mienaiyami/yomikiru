import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { ReactElement, useContext, useState, useEffect } from "react";
import { useAppContext } from "src/renderer/App";

const LocationListItem = ({
    name,
    link,
    inHistory,
    setCurrentLink,
    onContextMenu,
    focused,
}: {
    name: string;
    link: string;
    setCurrentLink: React.Dispatch<React.SetStateAction<string>>;
    inHistory: boolean;
    onContextMenu: (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, link: string, inHistory: boolean) => void;

    /**
     * for keyboard navigation
     */
    focused: boolean;
}): ReactElement => {
    const { openInReader, checkValidFolder, contextMenuData } = useAppContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const [contextMenuFocused, setContextMenuFocused] = useState(false);

    const onClickHandle = (a = true) => {
        if (!window.fs.existsSync(link)) {
            dialogUtils.customError({ message: "Directory/File doesn't exist." });
            return;
        }
        if (formatUtils.files.test(name)) {
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
        // try using active instead
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    return (
        <li
            className={`${inHistory ? "alreadyRead" : ""} ${contextMenuFocused ? "focused" : ""}`}
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
                    setContextMenuFocused(true);
                    onContextMenu(e, link, inHistory);
                }}
            >
                <span className="text">{formatUtils.files.getName(name)}</span>
                {formatUtils.files.test(name) && (
                    <code className="nonFolder">{formatUtils.files.getExt(name)}</code>
                )}
            </a>
            {!appSettings.hideOpenArrow && !formatUtils.files.test(name) && (
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
