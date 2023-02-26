import { useContext, useEffect, useRef, useState } from "react";
import { AppContext } from "../App";
import { addBookmark, removeBookmark } from "../store/bookmarks";
import { setContextMenu } from "../store/contextMenu";
import { removeHistory } from "../store/history";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const ContextMenu = () => {
    const dispatch = useAppDispatch();
    const contextData = useAppSelector((store) => store.contextMenu);
    const { openInReader, openInNewWindow } = useContext(AppContext);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (contextData && contextData.hasLink) {
            if (ref.current) {
                let x = contextData.clickX;
                let y = contextData.clickY - window.app.titleBarHeight;
                if (x >= window.innerWidth - ref.current.offsetWidth - 10) {
                    x -= ref.current.offsetWidth;
                }
                if (y >= window.innerHeight - ref.current.offsetHeight - 10) {
                    y -= ref.current.offsetHeight - window.app.titleBarHeight;
                }
                setPos({ x, y });
                ref.current.focus();
            }
        }
    }, [contextData]);
    // useEffect(() => {
    //     if (visible) props?.realRef.current?.focus();
    // }, [visible]);

    return (
        <div
            className="contextMenu"
            tabIndex={-1}
            onBlur={() => {
                setTimeout(() => dispatch(setContextMenu(null)), 100);
            }}
            onMouseUp={(e) => {
                e.stopPropagation();
                e.currentTarget.blur();
            }}
            ref={ref}
            style={{
                left: pos.x,
                top: pos.y,
                visibility: contextData && contextData.hasLink ? "visible" : "hidden",
            }}
        >
            <ul>
                {contextData?.hasLink?.simple?.isImage ? (
                    ""
                ) : (
                    <li role="menuitem" onMouseUp={() => openInReader(contextData?.hasLink?.link || "")}>
                        Open
                    </li>
                )}
                {contextData?.hasLink?.simple?.isImage ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            const img = window.electron.nativeImage.createFromPath(
                                contextData?.hasLink?.link || ""
                            );
                            if (img) window.electron.clipboard.writeImage(img);
                        }}
                    >
                        Copy
                    </li>
                ) : (
                    ""
                )}
                {contextData?.hasLink?.simple?.isImage ? (
                    ""
                ) : (
                    <li role="menuitem" onMouseUp={() => openInNewWindow(contextData?.hasLink?.link || "")}>
                        Open in new Window
                    </li>
                )}
                {contextData?.hasLink ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            window.electron.shell.showItemInFolder(contextData?.hasLink?.link || "");
                        }}
                    >
                        Show in File Explorer
                    </li>
                ) : (
                    ""
                )}
                <li
                    role="menuitem"
                    onMouseUp={() => window.electron.clipboard.writeText(contextData?.hasLink?.link || "")}
                >
                    Copy Path
                </li>
                {!contextData?.hasLink?.simple && !contextData?.hasLink?.chapterItem?.isBookmark ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            if (contextData?.hasLink?.chapterItem?.item)
                                dispatch(removeHistory(contextData?.hasLink?.chapterItem?.item.index));
                        }}
                    >
                        Remove
                    </li>
                ) : (
                    ""
                )}
                {contextData?.hasLink?.simple ? (
                    ""
                ) : contextData?.hasLink?.chapterItem?.isBookmark ? (
                    <li
                        role="menuitem"
                        onMouseUp={() => dispatch(removeBookmark(contextData?.hasLink?.link || ""))}
                    >
                        Remove Bookmark
                    </li>
                ) : (
                    <li
                        role="menuitem"
                        onMouseUp={() => {
                            if (contextData?.hasLink?.chapterItem?.item) {
                                const newItem: ChapterItem = {
                                    mangaName: contextData?.hasLink?.chapterItem?.item?.mangaName,
                                    chapterName: contextData?.hasLink?.chapterItem?.item?.chapterName,
                                    pages: contextData?.hasLink?.chapterItem?.item?.pages,
                                    page: contextData?.hasLink?.chapterItem?.item?.page,
                                    link: contextData?.hasLink?.link || "",
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
};

export default ContextMenu;
