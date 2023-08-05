import React, { useRef, useState, useEffect, useLayoutEffect, useContext } from "react";
import { AppContext } from "../../App";

//todo rename later for select only
const MenuList = () => {
    const { optSelectData } = useContext(AppContext);

    //todo, maybe add height,width to it as well.
    const [pos, setPos] = useState({ x: 0, y: 0, width: 1 });
    const [focused, setFocused] = useState(-1);
    const ref = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (optSelectData) {
            if (!optSelectData.elemBox) return window.logger.error("MenuList: elem box prop not provided.");
            if (ref.current) {
                let x = 0;
                let y = 0;
                let width = 0;
                if (optSelectData.elemBox instanceof HTMLElement) {
                    x = optSelectData.elemBox.getBoundingClientRect().x;
                    y =
                        optSelectData.elemBox.getBoundingClientRect().y +
                        optSelectData.elemBox.getBoundingClientRect().height +
                        4;
                    width = optSelectData.elemBox.getBoundingClientRect().width;
                } else if ("x" in optSelectData.elemBox) {
                    x = optSelectData.elemBox.x;
                    y = optSelectData.elemBox.y;
                    width = optSelectData.elemBox.width;
                }
                if (x >= window.innerWidth - ref.current.offsetWidth - 10) {
                    if (optSelectData.elemBox instanceof HTMLElement)
                        x = optSelectData.elemBox.getBoundingClientRect().right - ref.current.offsetWidth;
                    else x -= ref.current.offsetWidth;
                }
                if (y >= window.innerHeight - ref.current.offsetHeight - 10) {
                    if (optSelectData.elemBox instanceof HTMLElement)
                        y -= ref.current.offsetHeight + 8 + optSelectData.elemBox.getBoundingClientRect().height;
                    else y -= ref.current.offsetHeight;
                    if (y <= window.app.titleBarHeight && optSelectData.elemBox instanceof HTMLElement) {
                        y = window.app.titleBarHeight;
                        ref.current.style.maxHeight = optSelectData.elemBox.getBoundingClientRect().top + "px";
                    }
                }
                setPos({ x, y, width });
                ref.current.focus();
            }
        }
    }, [optSelectData]);

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
        optSelectData && (
            <div
                className="itemList"
                tabIndex={-1}
                onBlur={(e) => {
                    optSelectData.focusBackElem && optSelectData.focusBackElem.focus();
                    optSelectData.onBlur && optSelectData.onBlur(e);
                    // setTimeout(() => dispatch(setContextMenu(null)), 100);
                    // (contextMenuData.focusBackElem as HTMLElement | null)?.focus();
                    // setContextMenuData(null);
                }}
                onClick={onClick}
                onContextMenu={onClick}
                // ref={(node) => {
                //     ref.current = node;
                //     if (node) node.focus();
                // }}
                onWheel={(e) => {
                    e.stopPropagation();
                }}
                ref={ref}
                style={{
                    left: pos.x,
                    top: pos.y,
                    // display: display ? "block" : "none",
                    "--min-width": pos.width === 0 ? "fit-content" : pos.width + "px",
                    visibility: optSelectData.items.length > 0 ? "visible" : "hidden",
                }}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
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
                                if (init + 1 >= optSelectData.items.length) return 0;
                                return init + 1;
                            });
                            break;
                        case "ArrowUp":
                        case "ArrowLeft":
                            setFocused((init) => {
                                if (init - 1 < 0) return optSelectData.items.length - 1;
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
                    {optSelectData.items.map((e, i) => (
                        <li
                            role="menuitem"
                            key={e.label}
                            onClick={e.action}
                            onContextMenu={e.action}
                            style={e.style}
                            ref={(node) => {
                                if (node && i === focused)
                                    node.scrollIntoView({ behavior: "instant", block: "nearest" });
                            }}
                            data-focused={i === focused}
                            onMouseEnter={() => {
                                setFocused(i);
                            }}
                            // onMouseLeave={() => {
                            //     setFocused(-1);
                            // }}
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

export default MenuList;
