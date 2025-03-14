import React, { useRef, useState, useEffect, useLayoutEffect, useContext } from "react";
import { useAppContext } from "../../App";

import FocusLock from "react-focus-lock";
import { useAppSelector } from "../../store/hooks";
import { keyFormatter } from "@utils/keybindings";
import { getShortcutsMapped } from "@store/shortcuts";
import { shallowEqual } from "react-redux";

// ! not indented to be used without `AppContext::optSelectData`
//todo rename later for select only
const MenuList = () => {
    const { optSelectData } = useAppContext();
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);

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
                setFocused(optSelectData.items.findIndex((e) => e.selected));
                setPos({ x, y, width });
                ref.current.focus();
            }
        }
    }, [optSelectData]);

    useLayoutEffect(() => {
        const ff = () => {
            ref.current?.blur();
        };
        ref.current
            ?.querySelector(`[data-default-selected="true"]`)
            ?.scrollIntoView({ behavior: "instant", block: "nearest" });
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
            <FocusLock
                onDeactivation={() => {
                    optSelectData.focusBackElem && optSelectData.focusBackElem.focus();
                }}
            >
                <div
                    className="itemList"
                    tabIndex={-1}
                    onBlur={(e) => {
                        // optSelectData.focusBackElem && optSelectData.focusBackElem.focus();
                        optSelectData.onBlur && optSelectData.onBlur(e);
                    }}
                    onClick={onClick}
                    onContextMenu={onClick}
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

                        const keyStr = keyFormatter(e, false);
                        if (keyStr === "") return;

                        if (shortcutsMapped["contextMenu"].includes(keyStr)) {
                            e.currentTarget.blur();
                            return;
                        }
                        if (!e.ctrlKey && e.key.length === 1 && /^[\w]/i.test(e.key)) {
                            if (ref.current) {
                                const elems = [...ref.current.querySelectorAll("li")];
                                let i = focused;
                                i = elems.findIndex(
                                    (elem, i2) =>
                                        i < i2 &&
                                        elem.innerText.length > 0 &&
                                        elem.innerText[0].toLowerCase() === e.key.toLowerCase(),
                                );
                                if (i < 0) {
                                    i = elems.findIndex(
                                        (elem) =>
                                            elem.innerText.length > 0 &&
                                            elem.innerText[0].toLowerCase() === e.key.toLowerCase(),
                                    );
                                }
                                if (i >= 0) setFocused(i);
                                return;
                            }
                        }
                        switch (true) {
                            case keyStr === "escape":
                                e.currentTarget.blur();
                                break;
                            case shortcutsMapped["listDown"].includes(keyStr):
                            case keyStr === "right":
                                setFocused((init) => {
                                    if (init + 1 >= optSelectData.items.length) return 0;
                                    return init + 1;
                                });
                                break;
                            case shortcutsMapped["listUp"].includes(keyStr):
                            case keyStr === "left":
                                setFocused((init) => {
                                    if (init - 1 < 0) return optSelectData.items.length - 1;
                                    return init - 1;
                                });
                                break;
                            case shortcutsMapped["listSelect"].includes(keyStr):
                            case keyStr === "space": {
                                const elem = ref.current?.querySelector(
                                    '[data-focused="true"]',
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
                                data-default-selected={e.selected}
                                // onMouseLeave={() => {
                                //     setFocused(-1);
                                // }}
                                // className={`${e.selected ? "selected " : ""}`}
                            >
                                <span>{e.selected ? "•" : ""}</span>
                                {e.label}
                            </li>
                        ))}
                    </ul>
                </div>
            </FocusLock>
        )
    );
};

export default MenuList;
