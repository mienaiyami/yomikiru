import { useContext, memo, useEffect, useState } from "react";
import { useAppSelector } from "@store/hooks";
import { AppContext } from "src/renderer/App";
import { formatUtils } from "@utils/file";
// import { setContextMenu } from "../store/contextMenu";
// import { useAppDispatch } from "../store/hooks";

const ReaderSideListItem = memo(
    ({
        name,
        pages,
        link,
        inHistory,
        current,
        focused,
    }: {
        name: string;
        pages: number;
        link: string;
        inHistory: boolean;
        current: boolean;
        focused: boolean;
    }) => {
        const appSettings = useAppSelector((state) => state.appSettings);

        const { openInReader, setContextMenuData, contextMenuData } = useContext(AppContext);
        const [contextMenuFocused, setContextMenuFocused] = useState(false);
        useEffect(() => {
            if (!contextMenuData && contextMenuFocused) setContextMenuFocused(false);
        }, [contextMenuData]);

        // useEffect(()=>{
        //     if()
        // },[focused])

        return (
            <li
                className={`${inHistory ? "alreadyRead" : ""} ${current ? "current" : ""} ${
                    contextMenuFocused ? "focused" : ""
                }`}
                data-focused={focused}
                ref={(node) => {
                    if (node && focused) node.scrollIntoView({ block: "nearest" });
                }}
            >
                <a
                    onClick={() => openInReader(link)}
                    title={name}
                    ref={
                        appSettings.readerSettings.focusChapterInList
                            ? (node) => {
                                  if (current && node !== null) node.scrollIntoView({ block: "nearest" });
                              }
                            : undefined
                    }
                    data-url={link}
                    onContextMenu={(e) => {
                        // todo move it to parent
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
                            const chapters = [
                                ...e.currentTarget.parentElement.parentElement.querySelectorAll("a"),
                            ].map((e) => e.title);
                            items.push(
                                window.contextMenu.template.readAllChapter(window.path.dirname(link), chapters)
                            );
                        }
                        items.push(window.contextMenu.template.unreadAllChapter(window.path.dirname(link)));
                        items.push(window.contextMenu.template.divider());
                        items.push(window.contextMenu.template.copyPath(link));
                        items.push(window.contextMenu.template.showInExplorer(link));
                        setContextMenuFocused(true);
                        setContextMenuData({
                            clickX: e.clientX,
                            clickY: e.clientY,
                            // lmao wtf am i doing?, idk how react props works and dont want to include `sideListRef` in it fearing performance
                            focusBackElem:
                                e.nativeEvent.relatedTarget ||
                                e.currentTarget.parentElement?.parentElement?.parentElement?.parentElement,
                            items,
                        });
                    }}
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
                </a>
            </li>
        );
    }
);

export default ReaderSideListItem;
