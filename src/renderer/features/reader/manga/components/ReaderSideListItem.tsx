import ListItem from "@renderer/components/ListItem";
import { useAppSelector } from "@store/hooks";
import { formatUtils } from "@utils/file";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useAppContext } from "src/renderer/App";

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
        const { t } = useTranslation("reader");
        const focusChapterInList = useAppSelector((state) => state.appSettings.readerSettings?.focusChapterInList);
        const { openInReader, setContextMenuData } = useAppContext();

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
            if (e.currentTarget.parentElement?.parentElement) {
                const chapters = [...e.currentTarget.parentElement.parentElement.querySelectorAll("a")].map(
                    (e) => e.title,
                );
                items.push(window.contextMenu.template.readAllChapter(window.path.dirname(link), chapters));
            }
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
                focused={focused}
                scrollIntoView={Boolean(focusChapterInList && current)}
                classNameLi={`${inHistory ? "alreadyRead" : ""} ${current ? "current" : ""}`}
                onClick={handleClick}
                onContextMenu={handleContextMenu}
                title={name}
                dataAttributes={{
                    "data-url": link,
                }}
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
);
ReaderSideListItem.displayName = "ReaderSideListItem";

export default ReaderSideListItem;
