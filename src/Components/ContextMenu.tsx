import { useContext, useEffect, useRef, useState } from "react";
// import { AppContext } from "../App";
// import { addBookmark, removeBookmark } from "../store/bookmarks";
// import { setContextMenu } from "../store/contextMenu";
// import { removeHistory } from "../store/history";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { AppContext } from "../App";

const ContextMenu = () => {
    const dispatch = useAppDispatch();
    // const contextMenuData = useAppSelector((store) => store.contextMenu);
    const { contextMenuData, setContextMenuData } = useContext(AppContext);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (contextMenuData && contextMenuData.items.length > 0) {
            if (ref.current) {
                let x = contextMenuData.clickX;
                let y = contextMenuData.clickY - window.app.titleBarHeight;
                if (x >= window.innerWidth - ref.current.offsetWidth - 10) {
                    x -= ref.current.offsetWidth;
                }
                if (y >= window.innerHeight - ref.current.offsetHeight - 10) {
                    y -= ref.current.offsetHeight - window.app.titleBarHeight;
                }
                setPos({ x, y });
                ref.current.focus();
            }
        }
    }, [contextMenuData]);
    // useEffect(() => {
    //     if (visible) props?.realRef.current?.focus();
    // }, [visible]);

    return (
        contextMenuData && (
            <div
                className="contextMenu"
                tabIndex={-1}
                onBlur={() => {
                    // setTimeout(() => dispatch(setContextMenu(null)), 100);
                    setContextMenuData(null);
                }}
                onMouseUp={(e) => {
                    e.stopPropagation();
                    e.currentTarget.blur();
                }}
                ref={ref}
                style={{
                    left: pos.x,
                    top: pos.y,
                    visibility: contextMenuData && contextMenuData.items.length > 0 ? "visible" : "hidden",
                }}
            >
                <ul>
                    {contextMenuData.items.map((e) => (
                        <li
                            role="menuitem"
                            key={e.label}
                            onMouseUp={e.action}
                            className={`${e.disabled ? "disabled " : ""}`}
                        >
                            {e.label}
                        </li>
                    ))}
                </ul>
            </div>
        )
    );
};

export default ContextMenu;
