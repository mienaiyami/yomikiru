import { forwardRef, useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";

interface Iprops extends IContextMenuData {
    closeContextMenu: () => void;
    realRef: React.RefObject<HTMLDivElement>;
}
const ContextMenu = forwardRef((props: Iprops | null, ref: React.ForwardedRef<HTMLDivElement>) => {
    const { openInReader, setBookmarks, setHistory, addNewBookmark } = useContext(AppContext);
    const [link, setLink] = useState("");
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [visible, setVisible] = useState(false);
    const [isBookmark, setB] = useState(false);
    const [isHistory, setH] = useState(false);
    const [isFile, setFile] = useState(false);
    const [isImg, setImg] = useState(false);
    useEffect(() => {
        if (props) {
            setLink(props.link);
            setB(props.isBookmark || false);
            setH(props.isHistory || false);
            setFile(props.isFile || false);
            setImg(props.isImg || false);
            if (props.isBookmark || props.isHistory || props.isFile || props.isImg) {
                if (props.realRef.current) {
                    let x = props.e.clientX;
                    let y = props.e.clientY - window.titleBarHeight;
                    if (x >= window.innerWidth - props.realRef.current.offsetWidth - 10) {
                        x -= props.realRef.current.offsetWidth;
                    }
                    if (y >= window.innerHeight - props.realRef.current.offsetHeight - 10) {
                        y -= props.realRef.current.offsetHeight - window.titleBarHeight;
                    }
                    setPos({ x, y });
                }
                setVisible(true);
            }
        }
    }, [props]);
    useEffect(() => {
        if (visible) props?.realRef.current?.focus();
    }, [visible]);
    return (
        <div
            className="contextMenu"
            tabIndex={-1}
            onBlur={() => {
                props?.closeContextMenu();
            }}
            onClick={e => {
                e.currentTarget.blur();
            }}
            ref={ref}
            style={{ left: pos.x, top: pos.y, visibility: visible ? "visible" : "hidden" }}
        >
            <ul>
                {isImg ? (
                    ""
                ) : (
                    <li role="menuitem" onClick={() => openInReader(link)}>
                        Open
                    </li>
                )}
                {isImg ? (
                    <li
                        role="menuitem"
                        onClick={() => {
                            const img = window.electron.nativeImage.createFromPath(props!.link);
                            if (img) window.electron.clipboard.writeImage(img);
                        }}
                    >
                        Copy
                    </li>
                ) : (
                    ""
                )}
                {/* <li role="menuitem">Open in new Window</li> */}
                <li role="menuitem" onClick={() => window.electron.shell.showItemInFolder(link)}>
                    Show in File Explorer
                </li>
                <li role="menuitem" onClick={() => window.electron.clipboard.writeText(link)}>
                    Copy Path
                </li>
                {isHistory ? (
                    <li
                        role="menuitem"
                        onClick={() => {
                            if (props?.item)
                                setHistory(init => {
                                    const newData = init;
                                    newData.splice(props.item?.index || 0, 1);
                                    return [...newData];
                                });
                        }}
                    >
                        Remove
                    </li>
                ) : (
                    ""
                )}
                {isFile || isImg ? (
                    ""
                ) : isBookmark ? (
                    <li
                        role="menuitem"
                        onClick={() => setBookmarks(init => [...init.filter(e => e.link !== link)])}
                    >
                        Remove Bookmark
                    </li>
                ) : (
                    <li
                        role="menuitem"
                        onClick={() => {
                            if (props?.item) {
                                const newItem: ListItem = {
                                    mangaName: props?.item?.mangaName,
                                    chapterName: props?.item?.chapterName,
                                    pages: props?.item?.pages,
                                    link: link,
                                    date: new Date().toLocaleString(),
                                };
                                addNewBookmark(newItem);
                            }
                        }}
                    >
                        Add to Bookmarks
                    </li>
                )}
            </ul>
        </div>
    );
});

export default ContextMenu;
