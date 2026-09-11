import { useAppContext } from "@renderer/App";
import type React from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

/**
 * Fixed row height (px) for virtualized compact {@link ListItem} rows
 * (location list, reader side lists, etc.). Keep in sync with `.listCont` row padding.
 */
export const LIST_ITEM_ROW_PX = 30;

export type ListItemProps = {
    /** whether the item is currently focused via keyboard navigation */
    focused: boolean;
    /**
     * When true, scroll this row into view (e.g. current chapter when
     * manga reader `focusChapterInList` is enabled).
     */
    scrollIntoView?: boolean;
    /**
     * When true, a parent virtualizer owns scroll positioning; skip native
     * `scrollIntoView` on focus / {@link scrollIntoView}.
     */
    scrollManagedByParent?: boolean;
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
    /** Inline styles merged onto the row `<li>` (virtualizer absolute layout). */
    style?: React.CSSProperties;
    /** TanStack virtualizer row index when this `<li>` is the measured host. */
    "data-index"?: number;
};

/**
 * Shared list row (`<li>` + `<a>`) used by home lists and reader side lists.
 * Forwards the `<li>` ref so {@link ListNavigator.VirtualList} can measure rows
 * when `hostRowElement={false}`.
 */
const ListItem = forwardRef<HTMLLIElement, ListItemProps>(
    (
        {
            focused,
            scrollIntoView = false,
            scrollManagedByParent = false,
            classNameLi = "",
            classNameAnchor = "",
            children,
            onClick,
            onContextMenu,
            title,
            dataAttributes = {},
            leadingSlot,
            style,
            "data-index": dataIndex,
        },
        forwardedRef,
    ) => {
        const { contextMenuData } = useAppContext();
        const [contextMenuFocused, setContextMenuFocused] = useState(false);
        const itemRef = useRef<HTMLLIElement | null>(null);

        const setItemRef = useCallback(
            (node: HTMLLIElement | null) => {
                itemRef.current = node;
                if (typeof forwardedRef === "function") forwardedRef(node);
                else if (forwardedRef) forwardedRef.current = node;
            },
            [forwardedRef],
        );

        useEffect(() => {
            if (!contextMenuData) {
                setContextMenuFocused(false);
            }
        }, [contextMenuData]);

        useEffect(() => {
            if (scrollManagedByParent) return;
            if ((focused || scrollIntoView) && itemRef.current) {
                itemRef.current.scrollIntoView({ block: "nearest", behavior: "instant" });
            }
        }, [focused, scrollIntoView, scrollManagedByParent]);

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
                ref={setItemRef}
                className={`${classNameLi} ${contextMenuFocused ? "focused" : ""}`}
                data-focused={focused}
                data-index={dataIndex}
                style={style}
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
    },
);
ListItem.displayName = "ListItem";

export default ListItem;
