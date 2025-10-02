import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { keyFormatter } from "@utils/keybindings";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { shallowEqual } from "react-redux";
import { useAppContext } from "../App";

const ContextMenu = () => {
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const { contextMenuData, setContextMenuData } = useAppContext();
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

    useLayoutEffect(() => {
        const handleWheel = () => {
            ref.current?.blur();
        };
        window.addEventListener("wheel", handleWheel);
        return () => {
            window.removeEventListener("wheel", handleWheel);
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
                    const keyStr = keyFormatter(e, false);
                    if (keyStr === "") return;

                    if (shortcutsMapped.contextMenu.includes(keyStr)) {
                        e.currentTarget.blur();
                        return;
                    }
                    switch (true) {
                        case keyStr === "escape":
                            e.currentTarget.blur();
                            break;
                        case shortcutsMapped.listDown.includes(keyStr):
                        case keyStr === "right":
                            setFocused((init) => {
                                let f = init + 1;
                                if (f >= contextMenuData.items.length) f = 0;
                                if (ref.current?.querySelectorAll("ul li")[f]?.classList.contains("menu-divider"))
                                    f++;
                                return f;
                            });
                            break;
                        case shortcutsMapped.listUp.includes(keyStr):
                        case keyStr === "left":
                            setFocused((init) => {
                                let f = init - 1;
                                if (f < 0) f = contextMenuData.items.length - 1;
                                if (ref.current?.querySelectorAll("ul li")[f]?.classList.contains("menu-divider"))
                                    f--;
                                return f;
                            });
                            break;
                        case shortcutsMapped.listSelect.includes(keyStr):
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
                <ul className={contextMenuData.padLeft ? "padLeft" : ""}>
                    {contextMenuData.items.map((e, i) =>
                        e.divider ? (
                            <li key={`divider${i}`} className="menu-divider"></li>
                        ) : (
                            <li
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
                                {e.selected ? <FontAwesomeIcon icon={faCheck} /> : <span></span>}
                                {e.label}
                            </li>
                        ),
                    )}
                </ul>
            </div>
        )
    );
};

export default ContextMenu;
