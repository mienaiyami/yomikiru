import { useContext, useEffect, useRef, useState, useLayoutEffect } from "react";
// import { AppContext } from "../App";
// import { addBookmark, removeBookmark } from "../store/bookmarks";
// import { setContextMenu } from "../store/contextMenu";
// import { removeHistory } from "../store/history";
// import { useAppDispatch, useAppSelector } from "../store/hooks";
import { AppContext } from "../App";

const ContextMenu = () => {
    // const contextMenuData = useAppSelector((store) => store.contextMenu);
    const { contextMenuData, setContextMenuData } = useContext(AppContext);
    const [pos, setPos] = useState({ x: 0, y: 0 });
    const [focused, setFocused] = useState(-1);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (contextMenuData && contextMenuData.items.length > 0) {
            if (ref.current) {
                let x = contextMenuData.clickX;
                let y = contextMenuData.clickY;
                if (x >= window.innerWidth - ref.current.offsetWidth - 10) {
                    x -= ref.current.offsetWidth;
                }
                if (y >= window.innerHeight - ref.current.offsetHeight - 10) {
                    y -= ref.current.offsetHeight;
                }
                setPos({ x, y });
                ref.current.focus();
            }
        }
    }, [contextMenuData]);
    // useEffect(() => {
    //     if (visible) props?.realRef.current?.focus();
    // }, [visible]);

    useLayoutEffect(() => {
        const ff = () => {
            ref.current?.blur();
        };
        window.addEventListener("wheel", ff);
        return () => {
            window.removeEventListener("wheel", ff);
        };
    }, []);
    const onClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.stopPropagation();
        if (e.button < 0) return;
        const target = e.currentTarget;
        // needed coz menu became null before triggering action
        setTimeout(() => {
            target.blur();
        }, 100);
    };

    return (
        contextMenuData && (
            <div
                className="contextMenu"
                tabIndex={-1}
                onBlur={() => {
                    // setTimeout(() => dispatch(setContextMenu(null)), 100);
                    (contextMenuData.focusBackElem as HTMLElement | null)?.focus();
                    setContextMenuData(null);
                }}
                onClick={onClick}
                onContextMenu={onClick}
                ref={ref}
                style={{
                    left: pos.x,
                    top: pos.y,
                    visibility: contextMenuData && contextMenuData.items.length > 0 ? "visible" : "hidden",
                }}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (
                        (e.ctrlKey && e.key === "/") ||
                        (e.shiftKey && e.key === "F10") ||
                        e.key === "ContextMenu"
                    ) {
                        e.currentTarget.blur();
                        return;
                    }
                    switch (e.key) {
                        case "Escape":
                            e.currentTarget.blur();
                            break;
                        case "ArrowDown":
                        case "ArrowRight":
                            setFocused((init) => {
                                if (init + 1 >= contextMenuData.items.length) return 0;
                                return init + 1;
                            });
                            break;
                        case "ArrowUp":
                        case "ArrowLeft":
                            setFocused((init) => {
                                if (init - 1 < 0) return contextMenuData.items.length - 1;
                                return init - 1;
                            });
                            break;
                        case "Enter":
                        case " ": {
                            const elem = ref.current?.querySelector(
                                '[data-focused="true"]'
                            ) as HTMLLIElement | null;
                            if (elem && !elem.classList.contains("disabled")) elem.click();
                            break;
                        }
                        default:
                            break;
                    }
                }}
            >
                <ul>
                    {contextMenuData.items.map((e, i) => (
                        <li
                            role="menuitem"
                            key={e.label}
                            onClick={e.action}
                            onContextMenu={e.action}
                            data-focused={i === focused}
                            onMouseEnter={() => {
                                setFocused(i);
                            }}
                            onMouseLeave={() => {
                                setFocused(-1);
                            }}
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
