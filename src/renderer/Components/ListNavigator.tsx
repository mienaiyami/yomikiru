import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { useAppSelector } from "@store/hooks";
import { keyFormatter } from "@utils/keybindings";

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
    filterFn: (filter: string, item: T) => boolean;
    renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
    onContextMenu?: (element: HTMLElement) => void;
    onSelect?: (element: HTMLElement) => void;
    emptyMessage?: string;
    children: React.ReactNode;
};

function ListNavigatorProviderComponent<T>({
    items,
    filterFn,
    renderItem,
    onContextMenu,
    onSelect,
    emptyMessage = "No items",
    children,
}: ListNavigatorProps<T>) {
    const shortcuts = useAppSelector((store) => store.shortcuts);
    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLOListElement>(null);

    const filteredItems = useMemo(() => {
        return items.filter((item) => filterFn(filter, item));
    }, [items, filter, filterFn]);

    useEffect(() => {
        setFocused(-1);
        setFilter("");
        if (inputRef.current) {
            inputRef.current.value = "";
        }
    }, [items, inputRef]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent) => {
            e.stopPropagation();

            if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
                e.preventDefault();
            }

            const keyStr = keyFormatter(e);
            if (keyStr === "" && e.key !== "Escape") return;

            const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
                ShortcutCommands,
                string[]
            >;

            switch (true) {
                case shortcutsMapped["listDown"].includes(keyStr):
                    e.preventDefault();
                    setFocused((init) => {
                        if (init + 1 >= filteredItems.length) return 0;
                        return init + 1;
                    });
                    break;

                case shortcutsMapped["listUp"].includes(keyStr):
                    e.preventDefault();
                    setFocused((init) => {
                        if (init - 1 < 0) return filteredItems.length - 1;
                        return init - 1;
                    });
                    break;

                case shortcutsMapped["contextMenu"].includes(keyStr): {
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

                case shortcutsMapped["listSelect"].includes(keyStr): {
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
        },
        [shortcuts, filteredItems.length, onContextMenu, onSelect],
    );

    const handleFilterChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement> | string, skipProcessing = false) => {
            if (skipProcessing) {
                setFocused(-1);
                setFilter(typeof e === "string" ? e : e.target.value);
                return;
            }
            let val = typeof e === "string" ? e : e.target.value;

            val = val.replaceAll("[", "\\[");
            val = val.replaceAll("]", "\\]");
            val = val.replaceAll("(", "\\(");
            val = val.replaceAll(")", "\\)");
            val = val.replaceAll("*", "\\*");
            val = val.replaceAll("+", "\\+");

            let filter = "";
            if (['"', "`", "'"].includes(val[0])) {
                filter = "^" + val.replaceAll(/('|"|`)/g, "");
            } else
                for (let i = 0; i < val.length; i++) {
                    //todo: test in linux
                    if (val[i] === "\\") {
                        filter += "\\\\";
                        continue;
                    }
                    // if (val[i] === window.path.sep) {
                    //     filter += window.path.sep;
                    //     continue;
                    // }
                    filter += val[i] + ".*";
                }

            setFocused(-1);
            setFilter(filter);
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

const SearchInputComponent = ({
    placeholder = "Type to search",
    className = "search-input",
    onChange,
    runOriginalOnChange = false,
}: SearchInputProps) => {
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

const ListNavigator = {
    Provider: ListNavigatorProvider,
    SearchInput,
    List,
};

export default ListNavigator;
