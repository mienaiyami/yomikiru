import { useAppContext } from "@renderer/App";
import type React from "react";
import { useEffect, useRef, useState } from "react";

export type ListItemProps = {
    /** whether the item is currently focused via keyboard navigation */
    focused: boolean;
    /**
     * When true, scroll this row into view (e.g. current chapter when
     * manga reader `focusChapterInList` is enabled).
     */
    scrollIntoView?: boolean;
    classNameLi?: string;
    classNameAnchor?: string;
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    onContextMenu?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
    /** title attribute for the item (tooltip) */
    title?: string;
    /** additional data attributes to add to the item */
    dataAttributes?: Record<`data-${string}`, string>;
    /**
     * Optional content rendered as a sibling of the inner `<a>` (inside the
     * `<li>`). Used for per-row selection checkboxes that need their own click
     * target separate from the row's primary action.
     */
    leadingSlot?: React.ReactNode;
};

/**
 * Shared list row (`<li>` + `<a>`) used by home lists and reader side lists.
 */
const ListItem: React.FC<ListItemProps> = ({
    focused,
    scrollIntoView = false,
    classNameLi = "",
    classNameAnchor = "",
    children,
    onClick,
    onContextMenu,
    title,
    dataAttributes = {},
    leadingSlot,
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
        if ((focused || scrollIntoView) && itemRef.current) {
            itemRef.current.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
    }, [focused, scrollIntoView]);

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
        if (onContextMenu) {
            setContextMenuFocused(true);
            onContextMenu(e);
        }
    };

    const dataProps: Record<string, string> = {
        ...dataAttributes,
    };

    return (
        <li
            ref={itemRef}
            className={`${classNameLi} ${contextMenuFocused ? "focused" : ""}`}
            data-focused={focused}
        >
            {leadingSlot}
            <a
                onClick={onClick}
                className={classNameAnchor}
                onContextMenu={handleContextMenu}
                title={title}
                {...dataProps}
            >
                {children}
            </a>
        </li>
    );
};

export default ListItem;
