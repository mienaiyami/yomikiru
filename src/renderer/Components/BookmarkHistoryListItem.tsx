import { useContext, useState, useEffect } from "react";
import { AppContext } from "../App";
// import { setContextMenu } from "../store/contextMenu";
import { useAppDispatch, useAppSelector } from "../store/hooks";

const BookmarkHistoryListItem = (props: ListItemE) => {
    const { openInReader, setContextMenuData, contextMenuData } = useContext(AppContext);
    const appSettings = useAppSelector((store) => store.appSettings);
    const [contextMenuFocused, setContextMenuFocused] = useState(false);
    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    const title =
        props.type === "book"
            ? `Title       : ${props.data.title}\n` +
              `Chapter : ${props.data.chapter || "~"}\n` +
              `Date      : ${props.data.date}\n` +
              `Path      : ${props.data.link}`
            : `Manga   : ${props.data.mangaName}\n` +
              `Chapter : ${props.data.chapterName}\n` +
              `Pages    : ${props.data.pages}\n` +
              `Page      : ${props.data.page || 1}\n` +
              `Date      : ${props.data.date}\n` +
              `Path      : ${props.data.link}`;

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
                    if (!window.fs.existsSync(props.data.link)) {
                        window.dialog.customError({
                            message: "File/folder does not exit.",
                        });
                        return;
                    }
                    openInReader(
                        props.data.link,
                        props.type === "image"
                            ? props.data.page
                            : props.data.chapterURL || props.data.chapter || "",
                        props.type === "book" ? props.data.elementQueryString : ""
                    );
                }}
                onContextMenu={(e) => {
                    const items = [
                        window.contextMenu.template.open(props.data.link),
                        window.contextMenu.template.openInNewWindow(props.data.link),
                        window.contextMenu.template.showInExplorer(props.data.link),
                        window.contextMenu.template.copyPath(props.data.link),
                        window.contextMenu.template.divider(),
                    ];
                    if (props.isBookmark) items.push(window.contextMenu.template.removeBookmark(props.data.link));
                    else items.push(window.contextMenu.template.addToBookmark(props));
                    if (props.isHistory) items.push(window.contextMenu.template.removeHistory(props.data.link));

                    setContextMenuFocused(true);
                    setContextMenuData({
                        clickX: e.clientX,
                        clickY: e.clientY,
                        focusBackElem: e.nativeEvent.relatedTarget,
                        items,
                    });
                }}
            >
                {props.type === "book" ? (
                    <span className="double">
                        <span className="text">{props.data.title}</span>
                        <span className="text chapter">
                            <span className="text">{props.data.chapter || "~"}</span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                <code className="nonFolder">EPUB</code>
                            </span>
                        </span>
                    </span>
                ) : (
                    <span className="double">
                        <span className="text">{props.data.mangaName}</span>
                        <span className="chapter">
                            <span className="text">
                                {window.app.formats.files.getName(props.data.chapterName)}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {" "}
                                {window.app.formats.files.test(props.data.chapterName) && (
                                    <code className="nonFolder">
                                        {window.app.formats.files.getExt(props.data.chapterName)}
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
