import type { BookBookmark, MangaBookmark } from "@common/types/db";
import ListItem from "@renderer/components/ListItem";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem } from "@store/library";
import dateUtils from "@utils/date";
import { formatUtils } from "@utils/file";
import { resolveMissingOpenPath, shouldOfferLibraryRelocate } from "@utils/libraryMissingPath";
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
    const { openInReader, openInNewWindow, setContextMenuData } = useAppContext();
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

    const readerOptions = props.isHistory
        ? libraryItem.type === "book"
            ? {
                  epubChapterId: libraryItem.progress?.chapterId,
                  epubElementQueryString: libraryItem.progress?.position,
              }
            : { mangaPageNumber: libraryItem.progress?.currentPage || 1 }
        : props.bookmark && "chapterId" in props.bookmark
          ? {
                epubChapterId: props.bookmark.chapterId,
                epubElementQueryString: props.bookmark.position,
            }
          : { mangaPageNumber: props.bookmark?.page };

    /**
     * Shared by row click and context Open / Open in new Window so bookmark rows
     * keep Remove Bookmark (not delete whole library) when the path is missing.
     */
    const openFromList = (target: "reader" | "newWindow") => {
        const go = (openPath: string) => {
            if (target === "reader") openInReader(openPath, readerOptions);
            else openInNewWindow(openPath);
        };

        if (!window.fs.existsSync(link)) {
            void (async () => {
                const offerLocate = shouldOfferLibraryRelocate(libraryItem.link);
                const remapped = await resolveMissingOpenPath(dispatch, link, {
                    libraryItem,
                    offerLocate,
                    removeLabel: props.bookmark ? "Remove Bookmark" : undefined,
                    detail: props.bookmark
                        ? offerLocate
                            ? "Locate the library item on disk to keep progress, or remove this bookmark."
                            : "This chapter path is missing, but the library item is still on disk. Remove this bookmark or cancel."
                        : offerLocate
                          ? undefined
                          : "This chapter path is missing, but the library item is still on disk. Remove the library entry or cancel.",
                    onRemove: () => {
                        if (props.bookmark) {
                            dispatch(
                                removeBookmark({
                                    itemLink: libraryItem.link,
                                    ids: [props.id],
                                    type: libraryItem.type,
                                }),
                            );
                            return;
                        }
                        dispatch(deleteLibraryItem({ link: libraryItem.link }));
                    },
                });
                if (!remapped) return;
                go(remapped);
            })();
            return;
        }

        go(link);
    };

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (props.selectionMode) {
            props.onToggleSelected?.({ shiftKey: e.shiftKey });
            return;
        }
        openFromList("reader");
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
        const items = [
            {
                label: "Open",
                disabled: !link,
                action() {
                    openFromList("reader");
                },
            },
            {
                label: "Open in new Window",
                disabled: !link,
                action() {
                    openFromList("newWindow");
                },
            },
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
