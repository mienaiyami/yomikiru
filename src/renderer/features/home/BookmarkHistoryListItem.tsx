import { useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useContext, useState, useEffect } from "react";
import { useAppContext } from "src/renderer/App";

// todo: need to update this coz wont work with multiple bookmarks
const BookmarkHistoryListItem = (props: {
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
    // id from db
    id: number;
}) => {
    const { openInReader, setContextMenuData, contextMenuData } = useAppContext();
    const appSettings = useAppSelector((store) => store.appSettings);
    const libraryItem = useAppSelector((store) => store.library.items[props.link]);

    // todo: this is temp only until properly implemented
    if (!libraryItem) return <p>Error: Item not found</p>;
    if (libraryItem.type === "manga" && !libraryItem.progress) return <p>Error: Item not found</p>;
    const link = libraryItem.type === "book" ? libraryItem.link : libraryItem.progress?.chapterLink;
    if (!link) return <p>Error: Link not found</p>;
    const [contextMenuFocused, setContextMenuFocused] = useState(false);
    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    const title =
        libraryItem.type === "book"
            ? `Title       : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName || "~"}\n` +
              `Date      : ${libraryItem.progress?.lastReadAt}\n` +
              `Path      : ${libraryItem.link}`
            : `Manga   : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName}\n` +
              `Pages    : ${libraryItem.progress?.totalPages}\n` +
              `Page      : ${libraryItem.progress?.currentPage}\n` +
              `Date      : ${libraryItem.progress?.lastReadAt}\n` +
              `Path      : ${libraryItem.link}`;

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
                        libraryItem.type === "book"
                            ? {
                                  epubChapterId: libraryItem.progress?.chapterId,
                                  epubElementQueryString: libraryItem.progress?.position,
                              }
                            : { mangaPageNumber: libraryItem.progress?.currentPage || 1 }
                    );
                }}
                onContextMenu={(e) => {
                    const items = [
                        window.contextMenu.template.open(link),
                        window.contextMenu.template.openInNewWindow(link),
                        window.contextMenu.template.showInExplorer(link),
                        window.contextMenu.template.copyPath(link),
                        window.contextMenu.template.divider(),
                        window.contextMenu.template.removeHistory(props.link),
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
                {libraryItem.type === "book" ? (
                    <span className="double">
                        <span className="text">{libraryItem.title}</span>
                        <span className="text chapter">
                            <span className="text">{libraryItem.progress?.chapterName || "~"}</span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                <code className="nonFolder">EPUB</code>
                            </span>
                        </span>
                    </span>
                ) : (
                    <span className="double">
                        <span className="text">{libraryItem.title}</span>
                        <span className="chapter">
                            <span className="text">
                                {formatUtils.files.getName(libraryItem.progress?.chapterName || "~")}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                {formatUtils.files.test(libraryItem.progress?.chapterName || "~") && (
                                    <code className="nonFolder">
                                        {formatUtils.files.getExt(libraryItem.progress?.chapterName || "~")}
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
