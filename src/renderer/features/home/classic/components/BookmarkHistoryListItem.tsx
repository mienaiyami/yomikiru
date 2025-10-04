import type { BookBookmark, MangaBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import { addBookmark, removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem } from "@store/library";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { useAppContext } from "src/renderer/App";

const BookmarkHistoryListItem: React.FC<{
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
    // id from db
    id: number;
    bookmark?: MangaBookmark | BookBookmark;
}> = (props) => {
    const { openInReader, setContextMenuData } = useAppContext();
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

    const title = props.isHistory
        ? libraryItem.type === "book"
            ? `Title       : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName || "~"}\n` +
              `Date      : ${dateUtils.format(libraryItem.progress?.lastReadAt, {
                  format: dateUtils.presets.dateTimeFull,
              })}\n` +
              `Path      : ${libraryItem.link}`
            : `Manga   : ${libraryItem.title}\n` +
              `Chapter : ${libraryItem.progress?.chapterName}\n` +
              `Pages    : ${libraryItem.progress?.totalPages}\n` +
              `Page      : ${libraryItem.progress?.currentPage}\n` +
              `Date      : ${dateUtils.format(libraryItem.progress?.lastReadAt, {
                  format: dateUtils.presets.dateTimeFull,
              })}\n` +
              `Path      : ${libraryItem.link}`
        : `Title       : ${libraryItem.title}\n` +
          `Chapter : ${props.bookmark?.chapterName || "~"}\n` +
          `Date      : ${dateUtils.format(props.bookmark?.createdAt, {
              format: dateUtils.presets.dateTimeFull,
          })}\n` +
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

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const items = [
            window.contextMenu.template.open(link),
            window.contextMenu.template.openInNewWindow(link),
            window.contextMenu.template.showInExplorer(link),
            window.contextMenu.template.copyPath(link),
            {
                label: "Bookmark",
                action() {
                    const type = formatUtils.book.test(link) ? "book" : "manga";
                    if (type === "book" && libraryItem.progress && "chapterId" in libraryItem.progress) {
                        dispatch(
                            addBookmark({
                                type,
                                data: {
                                    chapterId: libraryItem.progress?.chapterId,
                                    position: libraryItem.progress?.position,
                                    chapterName: libraryItem.progress?.chapterName,
                                    itemLink: libraryItem.link,
                                },
                            }),
                        );
                    }
                    if (type === "manga" && libraryItem.progress && "currentPage" in libraryItem.progress) {
                        dispatch(
                            addBookmark({
                                type,
                                data: {
                                    link: libraryItem.progress?.chapterLink,
                                    itemLink: libraryItem.link,
                                    page: libraryItem.progress?.currentPage,
                                    chapterName: libraryItem.progress?.chapterName,
                                },
                            }),
                        );
                    }
                },
            },
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

        setContextMenuData({
            clickX: e.clientX,
            clickY: e.clientY,
            focusBackElem: e.nativeEvent.relatedTarget,
            items,
        });
    };

    return (
        <ListItem
            focused={props.focused}
            title={appSettings.showMoreDataOnItemHover ? title : undefined}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            classNameAnchor="big"
        >
            {libraryItem.type === "book" ? (
                <span className="double">
                    <span className="text">{libraryItem.title}</span>
                    <span className="chapter">
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
                                        props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~",
                                    )}
                                </code>
                            )}
                        </span>
                    </span>
                </span>
            )}
        </ListItem>
    );
};

export default BookmarkHistoryListItem;
