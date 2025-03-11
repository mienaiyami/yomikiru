import { useAppDispatch, useAppSelector } from "@store/hooks";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useContext, useState, useEffect } from "react";
import { useAppContext } from "src/renderer/App";
import { MangaBookmark, BookBookmark } from "@common/types/db";
import { removeBookmark } from "@store/bookmarks";
import { deleteLibraryItem } from "@store/library";

// todo: need to update this coz wont work with multiple bookmarks
const BookmarkHistoryListItem = (props: {
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
    // id from db
    id: number;
    bookmark?: MangaBookmark | BookBookmark;
}) => {
    const { openInReader, setContextMenuData, contextMenuData } = useAppContext();
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((store) => store.appSettings);
    const libraryItem = useAppSelector((store) => store.library.items[props.link]);

    if (props.isBookmark && !props.bookmark) return <p>Error: Bookmark not found</p>;

    // todo: this is temp only until properly implemented
    if (!libraryItem) return <p>Error: Item not found</p>;
    if (libraryItem.type === "manga" && !libraryItem.progress) return <p>Error: Item not found</p>;
    const link =
        props.bookmark && "page" in props.bookmark
            ? props.bookmark.link
            : libraryItem.type === "book"
            ? libraryItem.link
            : libraryItem.progress?.chapterLink;
    if (!link) return <p>Error: Link not found</p>;

    const [contextMenuFocused, setContextMenuFocused] = useState(false);

    useEffect(() => {
        if (!contextMenuData) setContextMenuFocused(false);
    }, [contextMenuData]);
    const title = props.isHistory
        ? libraryItem.type === "book"
            ? `Title       : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName || "~"}\n` +
              `Date      : ${libraryItem.progress?.lastReadAt}\n` +
              `Path      : ${libraryItem.link}`
            : `Manga   : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName}\n` +
              `Pages    : ${libraryItem.progress?.totalPages}\n` +
              `Page      : ${libraryItem.progress?.currentPage}\n` +
              `Date      : ${libraryItem.progress?.lastReadAt}\n` +
              `Path      : ${libraryItem.link}`
        : `Title       : ${libraryItem.title}\n` +
          `Chapter : ${props.bookmark?.chapterName || "~"}\n` +
          `Date      : ${props.bookmark?.createdAt}\n` +
          `Path      : ${props.bookmark?.itemLink}`;

    const handleClick = () => {
        if (!window.fs.existsSync(link)) {
            dialogUtils
                .confirm({
                    type: "error",
                    message: "File/folder does not exit. Remove item from library?",
                    noOption: false,
                    defaultId: 0,
                    cancelId: 1,
                })
                .then((res) => {
                    if (res.response === 0) {
                        if (props.bookmark) {
                            dispatch(
                                removeBookmark({
                                    itemLink: libraryItem.link,
                                    ids: [props.id],
                                    type: libraryItem.type,
                                }),
                            );
                        } else {
                            dispatch(
                                deleteLibraryItem({
                                    link: libraryItem.link,
                                }),
                            );
                        }
                    }
                });
            return;
        }
        let options = {};
        if (props.isHistory) {
            options =
                libraryItem.type === "book"
                    ? {
                          epubChapterId: libraryItem.progress?.chapterId,
                          epubElementQueryString: libraryItem.progress?.position,
                      }
                    : { mangaPageNumber: libraryItem.progress?.currentPage || 1 };
        } else {
            if (props.bookmark && "chapterId" in props.bookmark) {
                options = {
                    epubChapterId: props.bookmark?.chapterId,
                    epubElementQueryString: props.bookmark?.position,
                };
            } else {
                options = {
                    mangaPageNumber: props.bookmark?.page,
                };
            }
        }

        openInReader(link, options);
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const items = [
            window.contextMenu.template.open(link),
            window.contextMenu.template.openInNewWindow(link),
            window.contextMenu.template.showInExplorer(link),
            window.contextMenu.template.copyPath(link),
            window.contextMenu.template.divider(),
        ];

        if (props.isHistory) {
            items.push(window.contextMenu.template.removeHistory(props.link));
        }

        if (props.isBookmark && props.bookmark) {
            items.push(
                window.contextMenu.template.removeBookmark(
                    props.bookmark.itemLink,
                    props.bookmark.id,
                    libraryItem.type,
                ),
            );
        }
        //  else if (!props.isBookmark) {
        //     items.push(window.contextMenu.template.addToBookmark(props.link));
        // }

        setContextMenuFocused(true);
        setContextMenuData({
            clickX: e.clientX,
            clickY: e.clientY,
            focusBackElem: e.nativeEvent.relatedTarget,
            items,
        });
    };

    return (
        <li
            {...(appSettings.showMoreDataOnItemHover ? { title } : {})}
            className={`${contextMenuFocused ? "focused" : ""}`}
            data-focused={props.focused}
            ref={(node) => {
                if (node && props.focused) node.scrollIntoView({ block: "nearest" });
            }}
        >
            <a className="big" onClick={handleClick} onContextMenu={handleContextMenu}>
                {libraryItem.type === "book" ? (
                    <span className="double">
                        <span className="text">{libraryItem.title}</span>
                        <span className="text chapter">
                            <span className="text">
                                {props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~"}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                <code className="nonFolder">EPUB</code>
                            </span>
                        </span>
                    </span>
                ) : (
                    <span className="double">
                        <span className="text">{libraryItem.title}</span>
                        <span className="chapter">
                            <span className="text">
                                {formatUtils.files.getName(
                                    props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~",
                                )}
                            </span>
                            &nbsp;&nbsp;&nbsp;
                            <span className="page">
                                {formatUtils.files.test(
                                    props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~",
                                ) && (
                                    <code className="nonFolder">
                                        {formatUtils.files.getExt(
                                            props.bookmark?.chapterName ||
                                                libraryItem.progress?.chapterName ||
                                                "~",
                                        )}
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
