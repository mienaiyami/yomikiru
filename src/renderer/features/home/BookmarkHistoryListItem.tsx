import { useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useContext, useState, useEffect } from "react";
import { AppContext } from "src/renderer/App";

// todo: need to update this coz wont work with multiple bookmarks
const BookmarkHistoryListItem = (props: {
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
}) => {
    const { openInReader, setContextMenuData, contextMenuData } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);
    const item = useAppSelector((store) => store.library.items[props.link]);
    const link = item.type === "book" ? item.link : item.progress.chapterLink;
    if (!item) return <p>Error: Item not found</p>;
    const [contextMenuFocused, setContextMenuFocused] = useState(false);
    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    const title =
        item.type === "book"
            ? `Title       : ${item.title}\n` +
              `Chapter : ${item.progress?.chapterName || "~"}\n` +
              `Date      : ${item.progress?.lastReadAt}\n` +
              `Path      : ${item.link}`
            : `Manga   : ${item.title}\n` +
              `Chapter : ${item.progress?.chapterName}\n` +
              `Pages    : ${item.progress.totalPages}\n` +
              `Page      : ${item.progress.currentPage}\n` +
              `Date      : ${item.progress.lastReadAt}\n` +
              `Path      : ${item.link}`;

    return (
        <li
            {...(appSettings.showMoreDataOnItemHover ? { title } : {})}
            className={`${contextMenuFocused ? "focused" : ""}`}
            data-focused={props.focused}
            ref={(node) => {
                if (node && props.focused) node.scrollIntoView({ block: "nearest" });
            }}
        >
            <a
                className="big"
                onClick={() => {
                    if (!window.fs.existsSync(link)) {
                        dialogUtils.customError({
                            message: "File/folder does not exit.",
                        });
                        return;
                    }
                    openInReader(
                        link,
                        item.type === "book"
                            ? {
                                  epubChapterId: item.progress.chapterId,
                                  epubElementQueryString: item.progress.position,
                              }
                            : { mangaPageNumber: item.progress.currentPage }
                    );
                }}
                onContextMenu={(e) => {
                    const items = [
                        window.contextMenu.template.open(link),
                        window.contextMenu.template.openInNewWindow(link),
                        window.contextMenu.template.showInExplorer(link),
                        window.contextMenu.template.copyPath(link),
                        window.contextMenu.template.divider(),
                    ];
                    // if (props.isBookmark) items.push(window.contextMenu.template.removeBookmark(props.data.link));
                    // else items.push(window.contextMenu.template.addToBookmark(props));
                    // if (props.isHistory) items.push(window.contextMenu.template.removeHistory(props.data.link));

                    setContextMenuFocused(true);
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        focusBackElem: e.nativeEvent.relatedTarget,
                        items,
                    });
                }}
            >
                {item.type === "book" ? (
                    <span className="double">
                        <span className="text">{item.title}</span>
                        <span className="text chapter">
                            <span className="text">{item.progress.chapterName || "~"}</span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                <code className="nonFolder">EPUB</code>
                            </span>
                        </span>
                    </span>
                ) : (
                    <span className="double">
                        <span className="text">{item.title}</span>
                        <span className="chapter">
                            <span className="text">
                                {formatUtils.files.getName(item.progress.chapterName || "~")}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                {formatUtils.files.test(item.progress.chapterName || "~") && (
                                    <code className="nonFolder">
                                        {formatUtils.files.getExt(item.progress.chapterName || "~")}
                                    </code>
                                )}
                            </span>
                        </span>
                    </span>
                )}
            </a>
        </li>
    );
};

export default BookmarkHistoryListItem;
