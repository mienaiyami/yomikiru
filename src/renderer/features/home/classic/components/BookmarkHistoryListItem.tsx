import type { BookBookmark, MangaBookmark } from "@common/types/db";
import { ItemDisplayTitle } from "@renderer/components/ItemDisplayTitle";
import ListItem from "@renderer/components/ListItem";
import SelectionCheckbox from "@renderer/components/ui/SelectionCheckbox";
import { removeBookmark } from "@store/bookmarks";
import { useAppDispatch, useAppSelector } from "@store/hooks";
import { deleteLibraryItem, selectItemMetadata } from "@store/library";
import { selectTracker } from "@store/trackers";
import dateUtils from "@utils/date";
import { formatUtils } from "@utils/file";
import { resolveItemMetadata } from "@utils/libraryMetadata";
import {
    mangaPageForMissingKind,
    resolveMissingOpenPath,
    shouldOfferLibraryRelocate,
    updateMangaBookmarkChapterFromPath,
} from "@utils/libraryMissingPath";
import { resolveMangaChapterPath } from "@utils/mangaChapterPath";
import { type CSSProperties, forwardRef } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "src/renderer/App";
import { bookmarkLibraryItemsAtProgress } from "../listSelectionActions";

/**
 * Fixed row height (px) for virtualized classic History / Bookmarks rows.
 * Keep in sync with this component's double-line layout (title + meta).
 */
export const BOOKMARK_HISTORY_LIST_ROW_PX = 60;

type BookmarkHistoryListItemProps = {
    focused: boolean;
    isHistory: boolean;
    isBookmark: boolean;
    link: string;
    /** id from db */
    id: number;
    bookmark?: MangaBookmark | BookBookmark;
    /** When `true`, the item shows a checkbox and clicks toggle selection instead of opening. */
    selectionMode?: boolean;
    /** Whether this item is currently part of the selection. Required when `selectionMode` is true. */
    isChecked?: boolean;
    /** Toggles selection for this row. Receives click modifiers for Shift+range select. */
    onToggleSelected?: (opts: { shiftKey: boolean }) => void;
    /** Virtualizer absolute layout (injected by {@link ListNavigator.VirtualList}). */
    style?: CSSProperties;
    "data-index"?: number;
    scrollManagedByParent?: boolean;
};

/**
 * Classic History / Bookmarks row. Forwards the row ref for 1-column virtualization.
 */
const BookmarkHistoryListItem = forwardRef<HTMLLIElement, BookmarkHistoryListItemProps>((props, forwardedRef) => {
    const { t } = useTranslation("home");
    const { openInReader, openInNewWindow, setContextMenuData } = useAppContext();
    const dispatch = useAppDispatch();
    const appSettings = useAppSelector((store) => store.appSettings);
    const libraryItem = useAppSelector((store) => store.library.items[props.link]);
    const overlays = useAppSelector((store) => selectItemMetadata(store, props.link));
    const tracker = useAppSelector((store) => selectTracker(store, props.link, "anilist"));

    /*
     * Missing-row placeholders must still be a positioned `<li>`: VirtualList
     * injects absolute `style` / `data-index` onto this component; a bare `<p>`
     * would ignore them and sit in document flow under the tall virtual `<ol>`.
     */
    const missingRow = (message: string) => (
        <li ref={forwardedRef} style={props.style} data-index={props["data-index"]}>
            <p>{message}</p>
        </li>
    );

    if (props.isBookmark && !props.bookmark) return missingRow(t("classic.listItem.bookmarkNotFound"));

    // todo: this is temp only until properly implemented
    if (!libraryItem) return missingRow(t("classic.listItem.itemNotFound"));
    if (libraryItem.type === "manga" && !libraryItem.progress)
        return missingRow(t("classic.listItem.itemNotFound"));
    const link =
        props.bookmark && "page" in props.bookmark
            ? resolveMangaChapterPath(props.bookmark.itemLink, props.bookmark.chapterName)
            : libraryItem.type === "book"
              ? libraryItem.link
              : libraryItem.progress && "chapterName" in libraryItem.progress
                ? resolveMangaChapterPath(libraryItem.progress.itemLink, libraryItem.progress.chapterName)
                : "";
    if (!link) return missingRow(t("classic.listItem.linkNotFound"));

    const resolved = resolveItemMetadata({ item: libraryItem, overlays, tracker });
    const titleLabel = resolved.originalTitle
        ? t("gallery.details.titleWithOriginal", { title: resolved.title, original: resolved.originalTitle })
        : resolved.title;

    const title = props.isHistory
        ? libraryItem.type === "book"
            ? [
                  t("classic.listItem.tooltip.title", { value: titleLabel }),
                  t("classic.listItem.tooltip.chapter", {
                      value: libraryItem.progress?.chapterName || "~",
                  }),
                  t("classic.listItem.tooltip.date", {
                      value: dateUtils.format(libraryItem.progress?.lastReadAt, {
                          format: dateUtils.presets.dateTimeFull,
                      }),
                  }),
                  t("classic.listItem.tooltip.path", { value: libraryItem.link }),
              ].join("\n")
            : [
                  t("classic.listItem.tooltip.manga", { value: titleLabel }),
                  t("classic.listItem.tooltip.chapter", { value: libraryItem.progress?.chapterName }),
                  t("classic.listItem.tooltip.pages", { value: libraryItem.progress?.totalPages }),
                  t("classic.listItem.tooltip.page", { value: libraryItem.progress?.currentPage }),
                  t("classic.listItem.tooltip.date", {
                      value: dateUtils.format(libraryItem.progress?.lastReadAt, {
                          format: dateUtils.presets.dateTimeFull,
                      }),
                  }),
                  t("classic.listItem.tooltip.path", { value: libraryItem.link }),
              ].join("\n")
        : [
              t("classic.listItem.tooltip.title", { value: titleLabel }),
              t("classic.listItem.tooltip.chapter", { value: props.bookmark?.chapterName || "~" }),
              t("classic.listItem.tooltip.date", {
                  value: dateUtils.format(props.bookmark?.createdAt, {
                      format: dateUtils.presets.dateTimeFull,
                  }),
              }),
              t("classic.listItem.tooltip.path", { value: props.bookmark?.itemLink }),
          ].join("\n");

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
     * Shared by row click and context Open / Open in new Window.
     * Missing manga chapters: Open first chapter / Locate chapter (not library relocate).
     */
    const openFromList = (target: "reader" | "newWindow") => {
        const go = (openPath: string, opts = readerOptions) => {
            if (target === "reader") openInReader(openPath, opts);
            else openInNewWindow(openPath);
        };

        if (window.fs.existsSync(link)) {
            go(link);
            return;
        }

        void (async () => {
            const offerLocate = shouldOfferLibraryRelocate(libraryItem.link);
            const mangaBookmark = props.bookmark && "page" in props.bookmark ? props.bookmark : undefined;
            const isBookmarkRow = Boolean(props.bookmark);

            const missingDetail = (() => {
                if (offerLocate) {
                    return isBookmarkRow ? t("classic.listItem.missing.locateKeepProgress") : undefined;
                }
                return isBookmarkRow
                    ? t("classic.listItem.missing.chapterMissingKeepBookmark")
                    : t("classic.listItem.missing.chapterMissingLocate");
            })();

            const resolved = await resolveMissingOpenPath(dispatch, link, {
                libraryItem,
                offerLocate,
                /* history chapter-miss: no delete-library; remove stays on context menu */
                offerRemove: offerLocate || isBookmarkRow,
                removeLabel: isBookmarkRow ? t("classic.listItem.removeBookmark") : undefined,
                detail: missingDetail,
                onRemove: () => {
                    if (mangaBookmark) {
                        dispatch(
                            removeBookmark({
                                itemLink: libraryItem.link,
                                ids: [mangaBookmark.id],
                                type: libraryItem.type,
                            }),
                        );
                        return;
                    }
                    dispatch(deleteLibraryItem({ link: libraryItem.link }));
                },
                onLocateChapter: mangaBookmark
                    ? (chapterPath) => updateMangaBookmarkChapterFromPath(dispatch, mangaBookmark.id, chapterPath)
                    : undefined,
            });
            if (!resolved) return;

            const page = mangaPageForMissingKind(resolved.kind, mangaBookmark?.page);
            go(resolved.openPath, page === undefined ? readerOptions : { mangaPageNumber: page });
        })();
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
                label: t("classic.listItem.open"),
                disabled: !link,
                action() {
                    openFromList("reader");
                },
            },
            {
                label: t("classic.listItem.openInNewWindow"),
                disabled: !link,
                action() {
                    openFromList("newWindow");
                },
            },
            window.contextMenu.template.showInExplorer(link),
            window.contextMenu.template.copyPath(link),
            {
                label: t("classic.listItem.bookmark"),
                action() {
                    bookmarkLibraryItemsAtProgress(dispatch, [libraryItem]);
                },
            },
            window.contextMenu.template.divider(),
        ];

        if (props.isHistory) {
            items.push(
                window.contextMenu.template.removeProgress(props.link),
                window.contextMenu.template.removeHistory(props.link),
            );
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
            ariaLabel={t("shared.selectAria", { title: titleLabel })}
        />
    ) : null;

    return (
        <ListItem
            ref={forwardedRef}
            focused={props.focused}
            scrollManagedByParent={props.scrollManagedByParent}
            title={appSettings.showMoreDataOnItemHover ? title : undefined}
            onClick={handleClick}
            onContextMenu={handleContextMenu}
            classNameLi={props.isChecked ? "multiSelected" : ""}
            classNameAnchor={`big ${props.selectionMode ? "selectionMode" : ""} ${
                props.isChecked ? "multiSelected" : ""
            }`}
            leadingSlot={checkbox}
            style={props.style}
            data-index={props["data-index"]}
        >
            {libraryItem.type === "book" ? (
                <span className="double">
                    <span className="text">
                        <ItemDisplayTitle primary={resolved.title} original={resolved.originalTitle} />
                    </span>
                    <span className="chapter">
                        <span className="text">
                            {props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~"}
                        </span>
                        &nbsp;&nbsp;&nbsp;
                        <span className="page">
                            <code className="nonFolder">{t("shared.epub")}</code>
                        </span>
                    </span>
                </span>
            ) : (
                <span className="double">
                    <span className="text">
                        <ItemDisplayTitle primary={resolved.title} original={resolved.originalTitle} />
                    </span>
                    <span className="chapter">
                        <span className="text">
                            {formatUtils.files.getName(
                                props.bookmark?.chapterName || libraryItem.progress?.chapterName || "~",
                            )}
                        </span>
                        &nbsp;&nbsp;&nbsp;
                        <span className="page">
                            {formatUtils.mangaFile.test(
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
});
BookmarkHistoryListItem.displayName = "BookmarkHistoryListItem";

export default BookmarkHistoryListItem;
