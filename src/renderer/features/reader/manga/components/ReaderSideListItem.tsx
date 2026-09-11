import { useAppContext } from "@renderer/App";
import ListItem from "@renderer/components/ListItem";
import { formatUtils } from "@utils/file";
import { type CSSProperties, forwardRef, memo } from "react";
import { useTranslation } from "react-i18next";

type ReaderSideListItemProps = {
    name: string;
    pages: number;
    link: string;
    inHistory: boolean;
    current: boolean;
    focused: boolean;
    /**
     * Lazy chapter-name list for `readAllChapter`. Parent keeps names in a ref so
     * each row does not re-render when the filtered list identity changes.
     */
    getChapterNames: () => readonly string[];
    /** Virtualizer absolute layout (injected by {@link ListNavigator.VirtualList}). */
    style?: CSSProperties;
    "data-index"?: number;
    scrollManagedByParent?: boolean;
};

const ReaderSideListItem = memo(
    forwardRef<HTMLLIElement, ReaderSideListItemProps>(
        (
            {
                name,
                pages,
                link,
                inHistory,
                current,
                focused,
                getChapterNames,
                style,
                "data-index": dataIndex,
                scrollManagedByParent,
            },
            forwardedRef,
        ) => {
            const { t } = useTranslation("reader");
            const { openInReader, setContextMenuData } = useAppContext();

            const handleClick = () => {
                openInReader(link);
            };

            const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
                const items = [
                    window.contextMenu.template.open(link),
                    window.contextMenu.template.openInNewWindow(link),
                    window.contextMenu.template.divider(),
                ];
                if (inHistory) {
                    items.push(window.contextMenu.template.unreadChapter(window.path.dirname(link), name));
                } else {
                    items.push(window.contextMenu.template.readChapter(window.path.dirname(link), name));
                }
                /* resolve names at click time so rows do not hold the full filtered array */
                items.push(
                    window.contextMenu.template.readAllChapter(window.path.dirname(link), [...getChapterNames()]),
                );
                items.push(window.contextMenu.template.unreadAllChapter(window.path.dirname(link)));
                items.push(window.contextMenu.template.divider());
                items.push(window.contextMenu.template.copyPath(link));
                items.push(window.contextMenu.template.showInExplorer(link));
                setContextMenuData({
                    clickX: e.clientX,
                    clickY: e.clientY,
                    focusBackElem:
                        e.nativeEvent.relatedTarget ||
                        e.currentTarget.parentElement?.parentElement?.parentElement?.parentElement,
                    items,
                });
            };

            return (
                <ListItem
                    ref={forwardedRef}
                    focused={focused}
                    scrollManagedByParent={scrollManagedByParent}
                    classNameLi={`${inHistory ? "alreadyRead" : ""} ${current ? "current" : ""}`}
                    onClick={handleClick}
                    onContextMenu={handleContextMenu}
                    title={name}
                    dataAttributes={{
                        "data-url": link,
                    }}
                    style={style}
                    data-index={dataIndex}
                >
                    <span className="text">{formatUtils.files.getName(name)}</span>
                    {formatUtils.mangaFile.test(name) ? (
                        <code className="nonFolder">{formatUtils.files.getExt(name)}</code>
                    ) : (
                        <span className="pageNum" title={t("sideList.totalPages")}>
                            {pages}
                        </span>
                    )}
                </ListItem>
            );
        },
    ),
);
ReaderSideListItem.displayName = "ReaderSideListItem";

export default ReaderSideListItem;
