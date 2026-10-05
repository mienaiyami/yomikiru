import { useCommandOwner, useOwnerId } from "@features/keybindings";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { onWidgetActivateKey } from "@utils/keyboard";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAppContext } from "../App";

const ContextMenu = () => {
    const ownerId = useOwnerId("context-menu");
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

    const moveFocus = (delta: number) => {
        if (!contextMenuData) return;
        setFocused((init) => {
            let next = init + delta;
            if (next >= contextMenuData.items.length) next = 0;
            if (next < 0) next = contextMenuData.items.length - 1;
            if (ref.current?.querySelectorAll("ul li")[next]?.classList.contains("menu-divider")) {
                next += delta;
            }
            return next;
        });
    };

    const activateFocused = () => {
        const elem = ref.current?.querySelector('[data-focused="true"]') as HTMLLIElement | null;
        if (elem && !elem.classList.contains("disabled")) elem.click();
    };

    useCommandOwner({
        ownerId,
        /* menu blocks background commands; searchWidget is how list movement is catalogued */
        contextKinds: ["menu", "searchWidget"],
        visible: Boolean(contextMenuData && contextMenuData.items.length > 0),
        ownsEventTarget: (node) => Boolean(node instanceof Node && ref.current?.contains(node)),
        handlers: {
            listDown: () => moveFocus(1),
            listUp: () => moveFocus(-1),
            listSelect: () => activateFocused(),
            contextMenu: () => {
                ref.current?.blur();
            },
        },
        onEscape: () => {
            if (!ref.current?.contains(document.activeElement)) return false;
            ref.current.blur();
            return true;
        },
    });

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
                    onWidgetActivateKey(e, { space: activateFocused });
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
