import { memo, useEffect, useState } from "react";
import { useAppSelector } from "@store/hooks";
import { useAppContext } from "src/renderer/App";
import { formatUtils } from "@utils/file";
import ListItem from "src/renderer/components/ListItem";

type ReaderSideListItemProps = {
    name: string;
    pages: number;
    link: string;
    inHistory: boolean;
    current: boolean;
    focused: boolean;
    onClick?: () => void;
};

const ReaderSideListItem = memo(
    ({ name, pages, link, inHistory, current, focused, onClick }: ReaderSideListItemProps) => {
        const appSettings = useAppSelector((state) => state.appSettings);
        const { openInReader, setContextMenuData, contextMenuData } = useAppContext();
        const [contextMenuFocused, setContextMenuFocused] = useState(false);

        useEffect(() => {
            if (!contextMenuData && contextMenuFocused) setContextMenuFocused(false);
        }, [contextMenuData]);

        const handleClick = () => {
            if (onClick) {
                onClick();
            } else {
                openInReader(link);
            }
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
            if (e.currentTarget.parentElement && e.currentTarget.parentElement.parentElement) {
                const chapters = [...e.currentTarget.parentElement.parentElement.querySelectorAll("a")].map(
                    (e) => e.title,
                );
                items.push(window.contextMenu.template.readAllChapter(window.path.dirname(link), chapters));
            }
            items.push(window.contextMenu.template.unreadAllChapter(window.path.dirname(link)));
            items.push(window.contextMenu.template.divider());
            items.push(window.contextMenu.template.copyPath(link));
            items.push(window.contextMenu.template.showInExplorer(link));
            setContextMenuFocused(true);
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
                focused={focused}
                classNameLi={`${inHistory ? "alreadyRead" : ""} ${current ? "current" : ""}`}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                title={name}
                dataAttributes={{
                    // originally it was on anchor element
                    "data-url": link,
                }}
                ref={
                    appSettings.readerSettings?.focusChapterInList
                        ? (node) => {
                              if (current && node !== null) node.scrollIntoView({ block: "nearest" });
                          }
                        : undefined
                }
            >
                <span className="text">{formatUtils.files.getName(name)}</span>
                {formatUtils.files.test(name) ? (
                    <code className="nonFolder" data-type-text={formatUtils.book.test(name)}>
                        {formatUtils.files.getExt(name)}
                    </code>
                ) : (
                    <span className="pageNum" title="Total Pages">
                        {pages}
                    </span>
                )}
            </ListItem>
        );
    },
);

export default ReaderSideListItem;
