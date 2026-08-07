import type { BookBookmark, MangaBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem } from "@store/library";
import dateUtils from "@utils/date";
import { dialogUtils } from "@utils/dialog";
import { formatUtils } from "@utils/file";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { useAppContext } from "src/renderer/App";
import { bookmarkLibraryItemsAtProgress } from "../listSelectionActions";

const BookmarkHistoryListItem: React.FC<{
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
    // id from db
    id: number;
    bookmark?: MangaBookmark | BookBookmark;
    /** When `true`, the item shows a checkbox and clicks toggle selection instead of opening. */
    selectionMode?: boolean;
    /** Whether this item is currently part of the selection. Required when `selectionMode` is true. */
    isChecked?: boolean;
    /** Toggles selection for this row. Receives click modifiers for Shift+range select. */
    onToggleSelected?: (opts: { shiftKey: boolean }) => void;
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
            ? resolveMangaChapterPath(props.bookmark.itemLink, props.bookmark.chapterName)
            : libraryItem.type === "book"
              ? libraryItem.link
              : libraryItem.progress && "chapterName" in libraryItem.progress
                ? resolveMangaChapterPath(libraryItem.progress.itemLink, libraryItem.progress.chapterName)
                : "";
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

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (props.selectionMode) {
            props.onToggleSelected?.({ shiftKey: e.shiftKey });
            return;
        }
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
                    bookmarkLibraryItemsAtProgress(dispatch, [libraryItem]);
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

    const checkbox = props.onToggleSelected ? (
        <SelectionCheckbox
            className="rowSelectCheck"
            boxClassName="checkBox"
            checked={props.isChecked ?? false}
            onToggle={({ shiftKey }) => props.onToggleSelected?.({ shiftKey })}
            ariaLabel={`Select ${libraryItem.title}`}
        />
    ) : null;

    return (
        <ListItem
            focused={props.focused}
            title={appSettings.showMoreDataOnItemHover ? title : undefined}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            classNameLi={props.isChecked ? "multiSelected" : ""}
            classNameAnchor={`big ${props.selectionMode ? "selectionMode" : ""} ${
                props.isChecked ? "multiSelected" : ""
            }`}
            leadingSlot={checkbox}
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
