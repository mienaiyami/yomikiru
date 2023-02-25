import { forwardRef, useContext, useEffect, useState } from "react";
import { AppContext } from "../App";
import { addBookmark, removeBookmark } from "../store/bookmarks";
import { removeHistory } from "../store/history";
import { useAppDispatch } from "../store/hooks";

// todo: better prop type

interface Iprops extends IContextMenuData {
    closeContextMenu: () => void;
    realRef: React.RefObject<HTMLDivElement>;
}
const ContextMenu = forwardRef((props: Iprops | null, ref: React.ForwardedRef<HTMLDivElement>) => {
    const dispatch = useAppDispatch();
    const { openInReader, openInNewWindow } = useContext(AppContext);
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
                    let y = props.e.clientY - window.app.titleBarHeight;
                    if (x >= window.innerWidth - props.realRef.current.offsetWidth - 10) {
                        x -= props.realRef.current.offsetWidth;
                    }
                    if (y >= window.innerHeight - props.realRef.current.offsetHeight - 10) {
                        y -= props.realRef.current.offsetHeight - window.app.titleBarHeight;
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
                setTimeout(() => props?.closeContextMenu(), 100);
            }}
            onMouseUp={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
            }}
            ref={ref}
            style={{ left: pos.x, top: pos.y, visibility: visible ? "visible" : "hidden" }}
        >
            <ul>
                {isImg ? (
                    ""
                ) : (
                    <li role="menuitem" onMouseUp={() => openInReader(link)}>
                        Open
                    </li>
                )}
                {isImg ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            const img = window.electron.nativeImage.createFromPath(props!.link);
                            if (img) window.electron.clipboard.writeImage(img);
                        }}
                    >
                        Copy
                    </li>
                ) : (
                    ""
                )}
                {isImg ? (
                    ""
                ) : (
                    <li role="menuitem" onMouseUp={() => openInNewWindow(link)}>
                        Open in new Window
                    </li>
                )}
                <li
                    role="menuitem"
                    onMouseUp={() => {
                        window.electron.shell.showItemInFolder(link);
                    }}
                >
                    Show in File Explorer
                </li>
                <li role="menuitem" onMouseUp={() => window.electron.clipboard.writeText(link)}>
                    Copy Path
                </li>
                {isHistory ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            if (props?.item) dispatch(removeHistory(props.item.index));
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
                    <li role="menuitem" onMouseUp={() => dispatch(removeBookmark(link))}>
                        Remove Bookmark
                    </li>
                ) : (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            if (props?.item) {
                                const newItem: ChapterItem = {
                                    mangaName: props?.item?.mangaName,
                                    chapterName: props?.item?.chapterName,
                                    pages: props?.item?.pages,
                                    page: props?.item?.page,
                                    link: link,
                                    date: new Date().toLocaleString("en-UK", { hour12: true }),
                                };
                                dispatch(addBookmark(newItem));
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
