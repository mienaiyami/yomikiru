import { useState, useRef } from "react";
import { useAppSelector } from "@store/hooks";
import { keyFormatter } from "@utils/keybindings";

export type ListNavigationProps = {
    itemsLength: number;
    onContextMenu?: (element: HTMLElement) => void;
    onSelect?: (element: HTMLElement) => void;
};

export const useListNavigation = ({ itemsLength, onContextMenu, onSelect }: ListNavigationProps) => {
    const [filter, setFilter] = useState<string>("");
    const [focused, setFocused] = useState(-1);
    const listContainerRef = useRef<HTMLDivElement>(null);
    const shortcuts = useAppSelector((store) => store.shortcuts);

    const handleFilterChange = (value: string) => {
        let filterPattern = "";
        if (['"', "`", "'"].includes(value[0])) {
            filterPattern = "^" + value.replaceAll(/('|"|`)/g, "");
        } else {
            for (let i = 0; i < value.length; i++) {
                filterPattern += value[i] + ".*";
            }
        }
        setFocused(-1);
        setFilter(filterPattern);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        e.stopPropagation();
        if (/\[|\]|\(|\)|\*|\+|\?/gi.test(e.key)) {
            e.preventDefault();
        }
        if (e.key === "Escape") {
            (e.currentTarget as HTMLElement)?.blur();
        }

        const keyStr = keyFormatter(e);
        if (keyStr === "") return;

        const shortcutsMapped = Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<
            ShortcutCommands,
            string[]
        >;

        switch (true) {
            case shortcutsMapped["contextMenu"].includes(keyStr): {
                const elem = listContainerRef.current?.querySelector(
                    '[data-focused="true"] a',
                ) as HTMLElement | null;
                if (elem && onContextMenu) {
                    e.stopPropagation();
                    e.preventDefault();
                    (e.currentTarget as HTMLElement)?.blur();
                    onContextMenu(elem);
                }
                break;
            }
            case shortcutsMapped["listDown"].includes(keyStr):
                e.preventDefault();
                setFocused((init) => {
                    if (init + 1 >= itemsLength) return 0;
                    return init + 1;
                });
                break;
            case shortcutsMapped["listUp"].includes(keyStr):
                e.preventDefault();
                setFocused((init) => {
                    if (init - 1 < 0) return itemsLength - 1;
                    return init - 1;
                });
                break;
            case shortcutsMapped["listSelect"].includes(keyStr): {
                const elem = listContainerRef.current?.querySelector(
                    '[data-focused="true"] a',
                ) as HTMLElement | null;
                if (elem && onSelect) {
                    onSelect(elem);
                    return;
                }
                const elems = listContainerRef.current?.querySelectorAll("a");
                if (elems?.length === 1 && onSelect) {
                    onSelect(elems[0] as HTMLElement);
                }
                break;
            }
            default:
                break;
        }
    };

    return {
        filter,
        focused,
        listContainerRef,
        handleFilterChange,
        handleKeyDown,
        setFocused,
    };
};
