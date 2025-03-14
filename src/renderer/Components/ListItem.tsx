import React, { useEffect, useState, useRef } from "react";
import { useAppContext } from "src/renderer/App";

export interface ListItemProps {
    /** whether the item is currently focused via keyboard navigation */
    focused: boolean;
    classNameLi?: string;
    classNameAnchor?: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onContextMenu?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    /** title attribute for the item (tooltip) */
    title?: string;
    /** additional data attributes to add to the item */
    dataAttributes?: Record<`data-${string}`, string>;
    /** react reference to the anchor element */
    ref?: React.LegacyRef<HTMLAnchorElement>;
}

const ListItem: React.FC<ListItemProps> = ({
    focused,
    classNameLi = "",
    classNameAnchor = "",
    children,
    onClick,
    onContextMenu,
    title,
    dataAttributes = {},
    ref: anchorRef,
}) => {
    const { contextMenuData } = useAppContext();
    const [contextMenuFocused, setContextMenuFocused] = useState(false);
    const itemRef = useRef<HTMLLIElement>(null);

    useEffect(() => {
        if (!contextMenuData) {
            setContextMenuFocused(false);
        }
    }, [contextMenuData]);

    useEffect(() => {
        if (focused && itemRef.current) {
            itemRef.current.scrollIntoView({ block: "nearest" });
        }
    }, [focused]);

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (onContextMenu) {
            setContextMenuFocused(true);
            onContextMenu(e);
        }
    };

    const dataProps: Record<string, string> = {
        "data-focused": focused.toString(),
        ...dataAttributes,
    };

    return (
        <li ref={itemRef} className={`${classNameLi} ${contextMenuFocused ? "focused" : ""}`} {...dataProps}>
            <a
                ref={anchorRef}
                onClick={onClick}
                className={classNameAnchor}
                onContextMenu={handleContextMenu}
                title={title}
            >
                {children}
            </a>
        </li>
    );
};

export default ListItem;
