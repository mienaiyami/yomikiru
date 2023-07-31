import { useContext, memo, useEffect, useState } from "react";
import { AppContext } from "../App";
// import { setContextMenu } from "../store/contextMenu";
// import { useAppDispatch } from "../store/hooks";

const ReaderSideListItem = memo(
    ({
        name,
        pages,
        link,
        alreadyRead,
        current,
        focused,
    }: {
        name: string;
        pages: number;
        link: string;
        alreadyRead: boolean;
        current: boolean;
        focused: boolean;
    }) => {
        const { openInReader, setContextMenuData, contextMenuData } = useContext(AppContext);
        const [contextMenuFocused, setContextMenuFocused] = useState(false);
        useEffect(() => {
            if (!contextMenuData) setContextMenuFocused(false);
        }, [contextMenuData]);

        return (
            <li
                className={`${alreadyRead ? "alreadyRead" : ""} ${current ? "current" : ""} ${
                    focused ? "focused" : ""
                }`}
                data-focused={focused}
                ref={(node) => {
                    if (node && focused) node.scrollIntoView({ block: "nearest" });
                }}
            >
                <a
                    onClick={() => openInReader(link)}
                    title={name}
                    ref={(node) => {
                        if (current && node !== null) node.scrollIntoView({ block: "nearest" });
                    }}
                    onContextMenu={(e) => {
                        setContextMenuFocused(true);
                        setContextMenuData({
                            clickX: e.clientX,
                            clickY: e.clientY,
                            items: [
                                window.contextMenuTemplate.open(link),
                                window.contextMenuTemplate.openInNewWindow(link),
                                window.contextMenuTemplate.showInExplorer(link),
                                window.contextMenuTemplate.copyPath(link),
                            ],
                        });
                    }}
                >
                    <span className="text">{name.split(" $")[0]}</span>
                    {window.app.isSupportedFormat(name) ? (
                        <code className="nonFolder">{name.split(" $")[1]}</code>
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
