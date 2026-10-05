import { listWidgetOwnsEventTarget, useCommandOwner, useOwnerId } from "@features/keybindings";
import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { type PageSearchTargetOptions, usePageSearchFocus } from "@renderer/hooks/usePageSearchFocus";
import {
    observeElementRect as defaultObserveElementRect,
    type Rect,
    useVirtualizer,
    type Virtualizer,
} from "@tanstack/react-virtual";
import { createRendererLogger } from "@utils/logger";
import { scrollChildInContainer } from "@utils/utils";
import React, {
    createContext,
    memo,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

const log = createRendererLogger("components/ListNavigator");

/**
 * Prefer the element's layout offset size when a ResizeObserver reading is 0.
 *
 * TanStack's default observer can overwrite a good first `offsetHeight` with a
 * 0 `borderBoxSize` after classic/gallery remount. `virtualizer.measure()` only
 * clears item sizes and does not refresh scrollRect, so `getVirtualItems()`
 * stays empty (blank History / Bookmarks).
 *
 * @param element - TanStack scroll node (`getScrollElement()`)
 * @param rect - Observer callback size (RO `borderBoxSize` or `offset*` getRect)
 */
export const resolveObservedScrollRect = (element: Element | Window | null, rect: Rect): Rect => {
    if (
        element instanceof HTMLElement &&
        ((rect.height === 0 && element.offsetHeight > 0) || (rect.width === 0 && element.offsetWidth > 0))
    ) {
        return { width: element.offsetWidth, height: element.offsetHeight };
    }
    return rect;
};

/**
 * TanStack scrollport observer that applies {@link resolveObservedScrollRect}.
 */
const observeScrollElementRect = <T extends Element>(
    instance: Virtualizer<T, Element>,
    cb: (rect: Rect) => void,
): (() => void) | undefined => {
    return defaultObserveElementRect(instance, (rect) => {
        cb(resolveObservedScrollRect(instance.scrollElement, rect));
    });
};

/**
 * Stable identity for a list data item so TanStack Virtual can keep measured
 * sizes when filter/search reshuffles indices. Prefers `link` / `id` on objects;
 * strings and numbers are used as-is; otherwise falls back to the item index.
 * Row chrome heights live next to the row components that own that chrome (not here).
 */
export const resolveListItemKey = (item: unknown, fallbackIndex: number): string | number => {
    if (typeof item === "string" || typeof item === "number") return item;
    if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        if (typeof record.link === "string" || typeof record.link === "number") return record.link;
        if (typeof record.id === "string" || typeof record.id === "number") return record.id;
    }
    return fallbackIndex;
};

/**
 * TanStack Virtual row key for a 1-column or multi-column strip. Joining cell
 * keys means a filter that changes which items sit in a row invalidates that
 * row's cached size (index-only keys leave stale heights and visible gaps).
 *
 * @param filteredItems - Currently visible items after search/filter
 * @param rowIndex - Virtualizer row index (not the flat item index when cols > 1)
 * @param columnCount - Items per virtual row
 * @param getItemKey - Per-item identity; defaults to {@link resolveListItemKey}
 */
export const buildVirtualRowKey = <T,>(
    filteredItems: readonly T[],
    rowIndex: number,
    columnCount: number,
    getItemKey: (item: T, itemIndex: number) => string | number = resolveListItemKey,
): string | number => {
    const startIndex = rowIndex * columnCount;
    if (columnCount <= 1) {
        const item = filteredItems[startIndex];
        return item === undefined ? rowIndex : getItemKey(item, startIndex);
    }
    const parts: string[] = [];
    for (let c = 0; c < columnCount; c += 1) {
        const itemIndex = startIndex + c;
        if (itemIndex >= filteredItems.length) break;
        parts.push(String(getItemKey(filteredItems[itemIndex], itemIndex)));
    }
    return parts.length > 0 ? parts.join("\0") : rowIndex;
};

/**
 * Round DOM measurements so fractional DPI does not accumulate into hairline
 * gaps between absolutely positioned rows. Prefer `offsetHeight`/`offsetWidth`
 * (integer layout size, what TanStack used historically) over
 * `getBoundingClientRect` floats; fall back to the rect only for non-HTML nodes.
 */
export const measureVirtualElementSize = (
    element: Element,
    entry: ResizeObserverEntry | undefined,
    horizontal: boolean,
): number => {
    if (entry?.borderBoxSize?.[0]) {
        const box = entry.borderBoxSize[0];
        return Math.round(horizontal ? box.inlineSize : box.blockSize);
    }
    if (element instanceof HTMLElement) {
        return horizontal ? element.offsetWidth : element.offsetHeight;
    }
    return Math.round(element.getBoundingClientRect()[horizontal ? "width" : "height"]);
};

/**
 * Row for listSelect / contextMenu. Classic list rows set `data-focused` on the
 * `<li>` and the action lives on the inner `<a>`; gallery tiles and details rows
 * set `data-focused` on the clickable row itself.
 */
const queryFocusedListRow = (list: HTMLOListElement | null): HTMLElement | null => {
    const focused = list?.querySelector<HTMLElement>('[data-focused="true"]');
    if (!focused) return null;
    return focused.querySelector("a") ?? focused;
};

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
    /**
     * Stable identity for each data item. When omitted, {@link resolveListItemKey}
     * is used (`link` / `id` / primitive). Required for correct measured heights
     * after search/filter reshuffles indices.
     */
    getItemKey?: (item: T) => string | number;
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
    /**
     * Enter/listSelect when the list has no focused row (e.g. open the current
     * location folder). Built-in row select still runs first.
     */
    onSelectEmpty?: () => void;
    onSelect?: (element: HTMLElement) => void;
    emptyMessage?: string;
    /** When provided, assigned to the search input for external focus etc. */
    inputRef?: React.RefObject<HTMLInputElement>;
    /** Invoked when filteredItems or filterActive state changes. */
    onFilteredItemsChange?: (items: T[], filterActive: boolean) => void;
    /** When true, filter is not cleared when items or {@link ListNavigatorProps.resetFilterKey} change. */
    persistFilterOnItemsChange?: boolean;
    /**
     * Extra reset signal besides `items` identity. When this value changes, an
     * unpinned filter is cleared the same way as an items-identity change.
     */
    resetFilterKey?: unknown;
    /**
     * Stable identity for each data item (library link, bookmark id, etc.).
     * When omitted, {@link resolveListItemKey} is used. Pass this when items
     * lack `link`/`id` or need a custom id space.
     */
    getItemKey?: (item: T) => string | number;
    children: React.ReactNode;
};

function ListNavigatorProviderComponent<T>({
    items,
    filterFn,
    renderItem,
    onContextMenu,
    onSelectEmpty,
    onSelect,
    emptyMessage,
    inputRef: inputRefProp,
    onFilteredItemsChange,
    persistFilterOnItemsChange,
    resetFilterKey,
    getItemKey,
    children,
}: ListNavigatorProps<T>) {
    const { t } = useTranslation("common");
    const resolvedEmptyMessage = emptyMessage ?? t("list.noItems");
    const ownerId = useOwnerId("list-navigator");
    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const internalInputRef = useRef<HTMLInputElement>(null);
    const inputRef = inputRefProp ?? internalInputRef;
    const listRef = useRef<HTMLOListElement>(null);

    const filteredItems = useMemo(() => {
        return filterFn ? items.filter((item) => filterFn(filter, item)) : items;
    }, [items, filter, filterFn]);

    /* Keep latest callback without putting it in effect deps - parent often
     * passes an inline function; depending on identity re-fires setState loops. */
    const onFilteredItemsChangeRef = useRef(onFilteredItemsChange);
    onFilteredItemsChangeRef.current = onFilteredItemsChange;

    /* items identity and resetFilterKey both drop an unpinned filter */
    useEffect(() => {
        setFocused(-1);
        if (!persistFilterOnItemsChange) {
            setFilter("");
            if (inputRef.current) {
                inputRef.current.value = "";
            }
        }
    }, [items, inputRef, persistFilterOnItemsChange, resetFilterKey]);

    useEffect(() => {
        onFilteredItemsChangeRef.current?.(filteredItems, filter !== "");
    }, [filteredItems, filter]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        e.stopPropagation();
    }, []);

    const selectFocusedOrOnly = useCallback(() => {
        const elem = queryFocusedListRow(listRef.current);
        if (elem) {
            onSelect?.(elem);
            return;
        }
        const anchors = listRef.current?.querySelectorAll("a");
        if (anchors?.length === 1) {
            onSelect?.(anchors[0] as HTMLElement);
            return;
        }
        onSelectEmpty?.();
    }, [onSelect, onSelectEmpty]);

    useCommandOwner({
        ownerId,
        contextKinds: ["searchWidget"],
        visible: true,
        ownsEventTarget: (node) =>
            listWidgetOwnsEventTarget(
                node,
                inputRef.current,
                listRef.current,
                Boolean(queryFocusedListRow(listRef.current)),
            ),
        handlers: {
            listDown: () => {
                setFocused((init) => {
                    if (init + 1 >= filteredItems.length) return 0;
                    return init + 1;
                });
            },
            listUp: () => {
                setFocused((init) => {
                    if (init - 1 < 0) return filteredItems.length - 1;
                    return init - 1;
                });
            },
            listSelect: () => {
                selectFocusedOrOnly();
            },
            contextMenu: () => {
                const elem = queryFocusedListRow(listRef.current);
                if (!elem) return;
                inputRef.current?.blur();
                onContextMenu?.(elem);
            },
        },
        available: {
            /* A no-op handler would still consume the Menu key and kill the OS menu. */
            contextMenu: () => Boolean(queryFocusedListRow(listRef.current)),
        },
        onEscape: () => {
            if (document.activeElement !== inputRef.current) return false;
            inputRef.current?.blur();
            return true;
        },
    });

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
            emptyMessage: resolvedEmptyMessage,
            getItemKey,
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
            resolvedEmptyMessage,
            getItemKey,
        ],
    );

    return <ListNavigatorContext.Provider value={contextValue}>{children}</ListNavigatorContext.Provider>;
}

const ListNavigatorProvider = memo(ListNavigatorProviderComponent) as typeof ListNavigatorProviderComponent;

type SearchInputProps = {
    placeholder?: string;
    className?: string;
    /**
     * When set, this field is a candidate for {@link usePageSearchFocus}.
     * Context plus {@link PageSearchTargetOptions.tieOrder} pick among shown fields.
     */
    pageSearch?: PageSearchTargetOptions;
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
    /**
     * When true, focus the field after mount. Details lists pass false so Continue
     * / Start can take initial focus.
     * @default true
     */
    autoFocus?: boolean;
    /**
     * Wait this many milliseconds after mount before focusing when {@link SearchInputProps.autoFocus}
     * is true. Overlay search uses it so focus lands after the host sets `data-state="open"`
     * (visibility) and after FocusLock's mount effect, which otherwise steals the caret.
     */
    autoFocusDelayMs?: number;
    /**
     * Uncontrolled seed for the field (e.g. overlay search prefilled from a title).
     * Also shows the clear button when non-empty. Pair with
     * {@link ListNavigatorProps.persistFilterOnItemsChange} so the items-change
     * reset does not wipe the seeded value.
     */
    defaultValue?: string;
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

/**
 * Search field for {@link ListNavigator}. Uncontrolled input with a clear button
 * that appears while the field has text. Clear-button visibility is re-read from
 * the DOM when the filter settles, because the provider (and custom `onChange`
 * handlers) reset `input.value` directly.
 */
const SearchInputComponent: React.FC<SearchInputProps> = ({
    placeholder,
    className = "search-input",
    pageSearch,
    onChange,
    runOriginalOnChange = false,
    autoFocus = true,
    autoFocusDelayMs,
    defaultValue,
}) => {
    const { t } = useTranslation("common");
    const resolvedPlaceholder = placeholder ?? t("list.typeToSearch");
    const { inputRef, filter, handleFilterChange, handleKeyDown, setFocused } = useListNavigator();
    const [hasValue, setHasValue] = useState(() => Boolean(defaultValue));

    usePageSearchFocus(inputRef, {
        id: pageSearch?.id ?? "list-search-idle",
        contextKinds: pageSearch?.contextKinds ?? ["home"],
        tieOrder: pageSearch?.tieOrder,
        enabled: Boolean(pageSearch) && (pageSearch?.enabled ?? true),
    });

    useEffect(() => {
        if (!autoFocus) return;
        if (!autoFocusDelayMs) {
            inputRef.current?.focus();
            return;
        }
        const id = window.setTimeout(() => {
            inputRef.current?.focus();
        }, autoFocusDelayMs);
        return () => window.clearTimeout(id);
    }, [autoFocus, autoFocusDelayMs, inputRef]);

    /* The input is uncontrolled: the provider (and custom `onChange` handlers) reset
     * `input.value` directly. Re-read the DOM value whenever the filter settles so the
     * clear button never lingers after an external reset. */
    useEffect(() => {
        setHasValue(Boolean(inputRef.current?.value));
    }, [filter, inputRef]);

    /**
     * Runs a custom {@link SearchInputProps.onChange} then the list filter, matching
     * the input's onChange path so clear and typing stay in sync (remote-search
     * parents see the empty value).
     */
    const applyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        setHasValue(Boolean(e.target.value));
    };

    /**
     * Clears the uncontrolled input and the list filter, then focuses the field.
     * Uses the same change path as typing so a parent onChange sees the empty value.
     */
    const handleClear = () => {
        const input = inputRef.current;
        if (input) {
            input.value = "";
            input.focus();
            applyChange({
                target: input,
                currentTarget: input,
            } as React.ChangeEvent<HTMLInputElement>);
            return;
        }
        handleFilterChange("");
        setHasValue(false);
    };

    return (
        <div className={`${className}-wrapper`}>
            <input
                type="text"
                ref={inputRef}
                className={className}
                placeholder={resolvedPlaceholder}
                defaultValue={defaultValue}
                spellCheck="false"
                onKeyDown={handleKeyDown}
                onBlur={() => setFocused(-1)}
                onChange={applyChange}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            />
            {hasValue && (
                <button
                    type="button"
                    className={`${className}-clear`}
                    aria-label={t("list.clearSearch")}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleClear}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            )}
        </div>
    );
};

const SearchInput = SearchInputComponent;

type ListProps = {
    className?: string;
    /**
     * Overflow parent that should move when keyboard focus changes. Omit when the
     * `<ol>` itself scrolls, or when rows already scroll themselves (classic home lists).
     */
    scrollContainerRef?: React.RefObject<HTMLElement | null>;
};

const ListComponent = ({ className = "list-container", scrollContainerRef }: ListProps) => {
    const { filteredItems, focused, listRef, renderItem, emptyMessage } = useListNavigator();

    useLayoutEffect(() => {
        if (focused < 0) return;
        const container = scrollContainerRef?.current;
        const row = listRef.current?.querySelector<HTMLElement>('[data-focused="true"]');
        if (!container || !row) return;
        scrollChildInContainer(container, row, "nearest");
    }, [focused, listRef, scrollContainerRef]);

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
     * Row height in px. For the default fixed-size path this is the exact size
     * used for layout (no DOM measure). When {@link dynamicItemSize} is on, it
     * is only the initial estimate before measure.
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
     * Gallery cover grid passes the same gap as CSS `gap` on `.galleryList`; stacked lists use `0`.
     * @default 0
     */
    rowGapPx?: number;
    /**
     * When true (default), VirtualList wraps each virtual row in its own `<li>`
     * (gallery grid/list tiles). When false, `renderItem` must return the row
     * `<li>` (e.g. {@link ListItem}); VirtualList positions that node.
     */
    hostRowElement?: boolean;
    /**
     * When false (default), every row uses {@link estimatedItemSize} and skips
     * ResizeObserver measure - correct for uniform classic / gallery / side lists.
     * When true, rows are measured after mount (variable-height content only).
     */
    dynamicItemSize?: boolean;
    /**
     * Filtered-items index to mount and scroll into view (locate / auto-focus current).
     * Ignored when negative or undefined.
     */
    ensureVisibleIndex?: number;
    /** Alignment for {@link ensureVisibleIndex}. @default "auto" */
    ensureVisibleAlign?: "auto" | "start" | "center" | "end";
    /**
     * Bumps to re-run scroll when {@link ensureVisibleIndex} is unchanged
     * (e.g. locate button clicked again).
     */
    ensureVisibleNonce?: number;
    /**
     * Extra scroll-axis space before the first row (TanStack `paddingStart`).
     * Prefer this over CSS padding-top on the scroll parent so total size and
     * scroll-into-view stay aligned.
     */
    paddingStartPx?: number;
    /** Extra scroll-axis space after the last row (TanStack `paddingEnd`). */
    paddingEndPx?: number;
    /**
     * Inset used when scrolling a row into view (TanStack `scrollPaddingStart`).
     * Match the scroll parent's visual top inset when that inset is not in
     * {@link paddingStartPx}.
     */
    scrollPaddingStartPx?: number;
    /** Inset for scroll-into-view at the bottom edge (`scrollPaddingEnd`). */
    scrollPaddingEndPx?: number;
};

/**
 * Optional virtualized list: same context as {@link List}, but only visible items mount.
 *
 * **Why virtual "rows" instead of TanStack `lanes`:** In v3, `lanes` implements a
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
    rowGapPx = 0,
    hostRowElement = true,
    dynamicItemSize = false,
    ensureVisibleIndex,
    ensureVisibleAlign = "auto",
    ensureVisibleNonce,
    paddingStartPx = 0,
    paddingEndPx = 0,
    scrollPaddingStartPx = 0,
    scrollPaddingEndPx = 0,
}: VirtualListProps) => {
    const { filteredItems, focused, listRef, renderItem, emptyMessage, getItemKey } = useListNavigator();

    const cols = Math.max(1, columnCountProp);
    const rowCount = Math.ceil(filteredItems.length / cols);

    const resolveItemKey = useCallback(
        (item: (typeof filteredItems)[number], itemIndex: number) =>
            getItemKey ? getItemKey(item) : resolveListItemKey(item, itemIndex),
        [getItemKey],
    );

    /*
     * Identity keys (not row index): after search/filter the same index holds a
     * different item. Index-only keys leave stale size cache entries and visible
     * gaps; identity keys keep React remounts and cache aligned with data.
     */
    const getVirtualRowKey = useCallback(
        (rowIndex: number) => buildVirtualRowKey(filteredItems, rowIndex, cols, resolveItemKey),
        [cols, filteredItems, resolveItemKey],
    );

    const virtualizer = useVirtualizer({
        count: rowCount,
        /*
         * Read the parent scroll node from the ref each time (TanStack's documented
         * pattern). Do not mirror it into React state: that forces an extra render
         * on mount and left getVirtualItems() empty until the layout effect ran.
         */
        getScrollElement: () => scrollContainerRef.current,
        estimateSize: (_index: number) => estimatedItemSize,
        getItemKey: getVirtualRowKey,
        gap: rowGapPx,
        overscan,
        paddingStart: paddingStartPx,
        paddingEnd: paddingEndPx,
        scrollPaddingStart: scrollPaddingStartPx,
        scrollPaddingEnd: scrollPaddingEndPx,
        observeElementRect: observeScrollElementRect,
        /*
         * Fixed-size path omits measureElement on purpose: these product lists are
         * uniform row height. Measuring adds ResizeObserver work per row and was
         * the source of phantom gaps when cached sizes disagreed with estimates.
         * Callers that truly vary height pass dynamicItemSize.
         */
        ...(dynamicItemSize
            ? {
                  measureElement: (
                      element: Element,
                      entry: ResizeObserverEntry | undefined,
                      instance: { options: { horizontal?: boolean } },
                  ) => measureVirtualElementSize(element, entry, Boolean(instance.options.horizontal)),
                  useAnimationFrameWithResizeObserver: true,
              }
            : {}),
    });

    /*
     * The parent scroll ref is often still null in the first layout pass (child
     * VirtualList vs parent scroller). TanStack then never observes and
     * getVirtualItems() stays empty. Re-bind on the next frame once the node
     * exists. {@link resolveObservedScrollRect} still rejects 0-size RO readings.
     */
    useLayoutEffect(() => {
        const bindScrollElement = () => {
            if (!scrollContainerRef.current) return;
            virtualizer._willUpdate();
        };
        bindScrollElement();
        const rafId = requestAnimationFrame(bindScrollElement);
        return () => {
            cancelAnimationFrame(rafId);
        };
    }, [scrollContainerRef, virtualizer]);

    useEffect(() => {
        if (!dynamicItemSize) return;
        const id = requestAnimationFrame(() => {
            virtualizer.measure();
        });
        return () => {
            cancelAnimationFrame(id);
        };
    }, [
        cols,
        dynamicItemSize,
        estimatedItemSize,
        filteredItems,
        getVirtualRowKey,
        paddingEndPx,
        paddingStartPx,
        rowGapPx,
        scrollPaddingEndPx,
        scrollPaddingStartPx,
        virtualizer,
    ]);

    /* layout: listSelect/contextMenu must see [data-focused] after wrap-around */
    useLayoutEffect(() => {
        if (focused < 0 || filteredItems.length === 0) return;
        const rowIndex = Math.floor(focused / cols);
        /* instant: held listUp/listDown must not queue smooth animations */
        virtualizer.scrollToIndex(rowIndex, { align: "auto", behavior: "instant" });
    }, [cols, focused, filteredItems.length, virtualizer]);

    useLayoutEffect(() => {
        if (ensureVisibleIndex === undefined || ensureVisibleIndex < 0) return;
        if (ensureVisibleIndex >= filteredItems.length) return;
        const rowIndex = Math.floor(ensureVisibleIndex / cols);
        virtualizer.scrollToIndex(rowIndex, { align: ensureVisibleAlign, behavior: "instant" });
    }, [cols, ensureVisibleAlign, ensureVisibleIndex, ensureVisibleNonce, filteredItems.length, virtualizer]);

    if (filteredItems.length === 0) {
        return <p className="empty-message">{emptyMessage}</p>;
    }

    const vItems = virtualizer.getVirtualItems();
    const olClassName = `${className} is-virtual`.trim();
    /* fixed rows use virtualRow.size; dynamic rows size from content then measure */
    const rowHeight = (virtualRow: { size: number }): React.CSSProperties =>
        dynamicItemSize ? { height: "auto" } : { height: virtualRow.size };

    return (
        <ol
            ref={listRef}
            className={olClassName}
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
                if (!hostRowElement) {
                    const item = filteredItems[startIndex];
                    const rendered = renderItem(item, startIndex, focused === startIndex);
                    if (!React.isValidElement(rendered)) {
                        log.error("VirtualList hostRowElement=false requires renderItem to return an element");
                        return null;
                    }
                    const existingStyle =
                        rendered.props &&
                        typeof rendered.props === "object" &&
                        "style" in rendered.props &&
                        rendered.props.style &&
                        typeof rendered.props.style === "object"
                            ? (rendered.props.style as React.CSSProperties)
                            : {};
                    /* DOM hosts (native <li>) must not receive ListItem-only props */
                    const isCompositeRow = typeof rendered.type !== "string";
                    return React.cloneElement(
                        rendered as React.ReactElement<{
                            style?: React.CSSProperties;
                            "data-index"?: number;
                            scrollManagedByParent?: boolean;
                            ref?: React.Ref<HTMLLIElement>;
                        }>,
                        {
                            key: String(virtualRow.key),
                            "data-index": virtualRow.index,
                            ...(isCompositeRow ? { scrollManagedByParent: true } : {}),
                            ...(dynamicItemSize ? { ref: virtualizer.measureElement } : {}),
                            style: {
                                ...existingStyle,
                                position: "absolute",
                                top: virtualRow.start,
                                left: 0,
                                width: "100%",
                                ...rowHeight(virtualRow),
                            },
                        },
                    );
                }

                const cells: React.ReactNode[] = [];
                for (let c = 0; c < cols; c += 1) {
                    const index = startIndex + c;
                    if (index >= filteredItems.length) break;
                    const item = filteredItems[index];
                    cells.push(
                        <React.Fragment key={String(resolveItemKey(item, index))}>
                            {renderItem(item, index, focused === index)}
                        </React.Fragment>,
                    );
                }
                return (
                    <li
                        key={String(virtualRow.key)}
                        data-index={virtualRow.index}
                        ref={dynamicItemSize ? virtualizer.measureElement : undefined}
                        style={{
                            position: "absolute",
                            top: virtualRow.start,
                            left: 0,
                            width: "100%",
                            display: "grid",
                            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                            gap: `${gapPx}px`,
                            ...rowHeight(virtualRow),
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
