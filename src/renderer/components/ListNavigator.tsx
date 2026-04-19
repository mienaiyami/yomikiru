import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { useVirtualizer } from "@tanstack/react-virtual";
import { keyFormatter } from "@utils/keybindings";
import { createRendererLogger } from "@utils/logger";
import React, { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const log = createRendererLogger("components/ListNavigator");

import { shallowEqual } from "react-redux";

type ListNavigatorContextType<T> = {
    items: T[];
    filteredItems: T[];
    focused: number;
    filter: string;
    inputRef: React.RefObject<HTMLInputElement>;
    listRef: React.RefObject<HTMLOListElement>;
    /**
     * @param e - if string, use it as value instead of the input element
     * @param skipProcessing - if true, the value will not be processed and set directly
     * @default skipProcessing false
     */
    handleFilterChange: (e: React.ChangeEvent<HTMLInputElement> | string, skipProcessing?: boolean) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    setFocused: React.Dispatch<React.SetStateAction<number>>;
    renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
    onContextMenu?: (element: HTMLElement) => void;
    onSelect?: (element: HTMLElement) => void;
    emptyMessage: string;
};

const ListNavigatorContext = createContext<ListNavigatorContextType<any> | null>(null);

function useListNavigator<T>() {
    const context = useContext(ListNavigatorContext);
    if (!context) {
        throw new Error("useListNavigator must be used within a ListNavigator.Provider");
    }
    return context as ListNavigatorContextType<T>;
}

export type ListNavigatorProps<T> = {
    items: T[];
    filterFn?: (filter: string, item: T) => boolean;
    renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
    onContextMenu?: (element: HTMLElement) => void;
    handleExtraKeyDown?: (keyStr: string, shortcutsMapped: Record<ShortcutCommands, string[]>) => void;
    onSelect?: (element: HTMLElement) => void;
    emptyMessage?: string;
    /** When provided, assigned to the search input for external focus etc. */
    inputRef?: React.RefObject<HTMLInputElement>;
    /** Invoked when filteredItems or filterActive state changes. */
    onFilteredItemsChange?: (items: T[], filterActive: boolean) => void;
    /** When true, filter is not cleared when items change (e.g. on list refresh). */
    persistFilterOnItemsChange?: boolean;
    children: React.ReactNode;
};

function ListNavigatorProviderComponent<T>({
    items,
    filterFn,
    renderItem,
    onContextMenu,
    handleExtraKeyDown,
    onSelect,
    emptyMessage = "No items",
    inputRef: inputRefProp,
    onFilteredItemsChange,
    persistFilterOnItemsChange,
    children,
}: ListNavigatorProps<T>) {
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = inputRefProp ?? internalInputRef;
    const listRef = useRef<HTMLOListElement>(null);

    const filteredItems = useMemo(() => {
        return filterFn ? items.filter((item) => filterFn(filter, item)) : items;
    }, [items, filter, filterFn]);

    useEffect(() => {
        setFocused(-1);
        if (!persistFilterOnItemsChange) {
            setFilter("");
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }, [items, inputRef, persistFilterOnItemsChange]);

    useEffect(() => {
        onFilteredItemsChange?.(filteredItems, filter !== "");
    }, [filteredItems, filter, onFilteredItemsChange]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            e.stopPropagation();

            const keyStr = keyFormatter(e);
            if (keyStr === "" && e.key !== "Escape") return;

            switch (true) {
                case shortcutsMapped.listDown.includes(keyStr):
                    e.preventDefault();
                    setFocused((init) => {
                        if (init + 1 >= filteredItems.length) return 0;
                        return init + 1;
                    });
                    break;

                case shortcutsMapped.listUp.includes(keyStr):
                    e.preventDefault();
                    setFocused((init) => {
                        if (init - 1 < 0) return filteredItems.length - 1;
                        return init - 1;
                    });
                    break;

                case shortcutsMapped.contextMenu.includes(keyStr): {
                    const elem = listRef.current?.querySelector('[data-focused="true"] a') as HTMLElement | null;
                    if (elem) {
                        e.stopPropagation();
                        e.preventDefault();
                        if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.blur();
                        }
                        onContextMenu?.(elem);
                    }
                    break;
                }

                case shortcutsMapped.listSelect.includes(keyStr): {
                    const elem = listRef.current?.querySelector('[data-focused="true"] a') as HTMLElement | null;
                    if (elem) return onSelect?.(elem);
                    const elems = listRef.current?.querySelectorAll("a");
                    if (elems?.length === 1) return onSelect?.(elems[0] as HTMLElement);
                    break;
                }

                case e.key === "Escape":
                    inputRef.current?.blur();
                    break;

                default:
                    break;
            }
            handleExtraKeyDown?.(keyStr, shortcutsMapped);
        },
        [shortcutsMapped, filteredItems.length, onContextMenu, onSelect, handleExtraKeyDown],
    );

    const handleFilterChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement> | string, skipProcessing = false) => {
            if (skipProcessing) {
                setFocused(-1);
                setFilter(typeof e === "string" ? e : e.target.value);
                return;
            }
            const val = typeof e === "string" ? e : e.target.value;

            if (!val.trim()) {
                setFocused(-1);
                setFilter("");
                return;
            }

            try {
                const mustEscape = "[]().*+?^$|{}";

                const escapeRegex = (text: string): string => {
                    for (const c of mustEscape) text = text.replaceAll(c, `\\${c}`);
                    return text;
                };

                const quoteChars = ['"', "`", "'"];

                let filter = "";

                if (quoteChars.includes(val[0])) {
                    const searchText = val.slice(1).trim();

                    if (!searchText) {
                        filter = "";
                    } else {
                        const escapedText = escapeRegex(searchText);
                        filter = escapedText;
                    }
                } else {
                    const terms = val
                        .split(/\s+/)
                        .filter(Boolean)
                        .map((term) => escapeRegex(term));

                    if (terms.length === 0) {
                        filter = "";
                    } else if (terms.length === 1) {
                        filter = terms[0]
                            .split("")
                            .map((char) => escapeRegex(char))
                            .join(".*");
                    } else {
                        // Multi-term search - all terms should appear in the result
                        // Using positive lookahead assertions for each term
                        // This makes the search order-independent but requires all terms
                        filter = terms
                            .map((term) => {
                                return `(?=.*${term})`;
                            })
                            .join("");

                        filter += ".*";
                    }
                }

                // to check for error before applying
                new RegExp(filter);

                setFocused(-1);
                setFilter(filter);
            } catch (error) {
                log.error("search filter threw", error);
                setFocused(-1);

                const safeFilter = val.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                setFilter(safeFilter);
            }
        },
        [],
    );

    // todo : check if useMemo is even needed
    const contextValue = useMemo(
        () => ({
            items,
            filteredItems,
            focused,
            filter,
            inputRef,
            listRef,
            handleFilterChange,
            handleKeyDown,
            setFocused,
            renderItem,
            onContextMenu,
            onSelect,
            emptyMessage,
        }),
        [
            items,
            filteredItems,
            focused,
            filter,
            handleFilterChange,
            handleKeyDown,
            renderItem,
            onContextMenu,
            onSelect,
            emptyMessage,
        ],
    );

    return <ListNavigatorContext.Provider value={contextValue}>{children}</ListNavigatorContext.Provider>;
}

const ListNavigatorProvider = memo(ListNavigatorProviderComponent) as typeof ListNavigatorProviderComponent;

type SearchInputProps = {
    placeholder?: string;
    className?: string;
    /** @returns value to set to the filter when `runOriginalOnChange` is true
     * or return anything when `runOriginalOnChange` is false
     */
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => string | unknown;
    /**
     * if true, the original onChange event will run after the onChange,
     * with the return value of onChange as the new filter
     * @default false
     */
    runOriginalOnChange?: boolean;
} & (
    | {
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => string;
          runOriginalOnChange: true;
      }
    | {
          onChange?: (e: React.ChangeEvent<HTMLInputElement>) => unknown;
          runOriginalOnChange?: false;
      }
);

const SearchInputComponent: React.FC<SearchInputProps> = ({
    placeholder = "Type to search",
    className = "search-input",
    onChange,
    runOriginalOnChange = false,
}) => {
    const { inputRef, handleFilterChange, handleKeyDown, setFocused } = useListNavigator();

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, [inputRef]);

    return (
        <input
            type="text"
            ref={inputRef}
            className={className}
            placeholder={placeholder}
            spellCheck="false"
            onKeyDown={handleKeyDown}
            onBlur={() => setFocused(-1)}
            onChange={(e) => {
                if (onChange) {
                    const val = onChange(e);
                    if (val === undefined && runOriginalOnChange) {
                        throw new Error("onChange returned undefined but runOriginalOnChange is true");
                    }
                    // need to `typeof val === "string"` because empty string is valid
                    if (runOriginalOnChange && typeof val === "string") {
                        handleFilterChange(val);
                    } else if (typeof val === "string") {
                        handleFilterChange(e, true);
                    }
                    if (val === "") {
                        e.target.value = "";
                    }
                } else {
                    handleFilterChange(e);
                }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
            }}
        />
    );
};

const SearchInput = SearchInputComponent;

type ListProps = {
    className?: string;
};

const ListComponent = ({ className = "list-container" }: ListProps) => {
    const { filteredItems, focused, listRef, renderItem, emptyMessage } = useListNavigator();

    if (filteredItems.length === 0) {
        return <p className="empty-message">{emptyMessage}</p>;
    }

    return (
        <ol ref={listRef} className={className}>
            {filteredItems.map((item, index) => (
                <React.Fragment key={index}>{renderItem(item, index, focused === index)}</React.Fragment>
            ))}
        </ol>
    );
};

const List = ListComponent;

export type VirtualListProps = {
    className?: string;
    /** Ref to the element that has overflow-y: auto/scroll */
    scrollContainerRef: React.RefObject<HTMLElement | null>;
    /**
     * Estimated row height in px. Used by useVirtualizer as the initial size;
     * row elements are measured to refine height.
     */
    estimatedItemSize: number;
    /** Items per row for grid layouts; 1 for single-column list. @default 1 */
    columnCount?: number;
    /** Extra rows rendered above and below visible area. @default 5 */
    overscan?: number;
    /**
     * Horizontal gap between cells inside a row (CSS `gap` on the row grid). @default 16
     */
    gapPx?: number;
    /**
     * Vertical gap between virtual rows, passed to TanStack as `gap` (scroll-axis spacing).
     * Use `0` for layouts that stack without inter-row gap (e.g. gallery list mode).
     * @default 16
     */
    rowGapPx?: number;
};

/**
 * Optional virtualized list: same context as {@link List}, but only visible items mount.
 *
 * **Why virtual “rows” instead of TanStack `lanes`:** In v3, `lanes` implements a
 * masonry-style column fill (shortest column gets the next item), i.e. column-major order.
 * A CSS Grid gallery is row-major (fill the row, then the next). For uniform grids, one
 * virtual item per logical row matches that layout and keeps `gap` predictable: `rowGapPx`
 * is the library’s scroll-axis `gap`; `gapPx` is the per-row CSS grid gap (columns, and row
 * internal spacing inside that strip).
 */
const VirtualListComponent = ({
    className = "list-container",
    scrollContainerRef,
    estimatedItemSize,
    columnCount: columnCountProp = 1,
    overscan = 5,
    gapPx = 16,
    rowGapPx = 16,
}: VirtualListProps) => {
    const { filteredItems, focused, listRef, renderItem, emptyMessage } = useListNavigator();

    const cols = Math.max(1, columnCountProp);
    const rowCount = Math.ceil(filteredItems.length / cols);

    const virtualizer = useVirtualizer({
        count: rowCount,
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (_index: number) => estimatedItemSize,
        gap: rowGapPx,
        overscan,
        useAnimationFrameWithResizeObserver: true,
    });

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            virtualizer.measure();
        });
        return () => {
            cancelAnimationFrame(id);
        };
    }, [cols, estimatedItemSize, filteredItems.length, rowGapPx, virtualizer]);

    useEffect(() => {
        if (focused < 0 || filteredItems.length === 0) return;
        const rowIndex = Math.floor(focused / cols);
        virtualizer.scrollToIndex(rowIndex, { align: "auto", behavior: "smooth" });
    }, [cols, focused, filteredItems.length, virtualizer]);

    if (filteredItems.length === 0) {
        return <p className="empty-message">{emptyMessage}</p>;
    }

    const vItems = virtualizer.getVirtualItems();

    return (
        <ol
            ref={listRef}
            className={className}
            style={{
                display: "block",
                position: "relative",
                width: "100%",
                height: `${virtualizer.getTotalSize()}px`,
                listStyle: "none",
                margin: 0,
                padding: 0,
            }}
        >
            {vItems.map((virtualRow) => {
                const startIndex = virtualRow.index * cols;
                const cells: React.ReactNode[] = [];
                for (let c = 0; c < cols; c += 1) {
                    const index = startIndex + c;
                    if (index >= filteredItems.length) break;
                    const item = filteredItems[index];
                    cells.push(
                        <React.Fragment key={index}>{renderItem(item, index, focused === index)}</React.Fragment>,
                    );
                }
                return (
                    <li
                        key={String(virtualRow.key)}
                        data-index={virtualRow.index}
                        ref={virtualizer.measureElement}
                        style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            display: "grid",
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            gap: `${gapPx}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                            /**
                             * Do not set `minHeight` to `virtualRow.size`: that value is only an
                             * estimate. Forcing it makes rows taller than their content (visible gap
                             * under tiles when grid items use `align-items: start`).
                             */
                            alignItems: "start",
                        }}
                    >
                        {cells}
                    </li>
                );
            })}
        </ol>
    );
};

const VirtualList = VirtualListComponent;

const ListNavigator = {
    Provider: ListNavigatorProvider,
    SearchInput,
    List,
    VirtualList,
};

export default ListNavigator;
