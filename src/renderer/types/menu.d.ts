declare namespace Menu {
    type ListItem = {
        label: string;
        action: () => void;
        disabled?: boolean;
        /**
         * checked or enabled
         */
        selected?: boolean;
        style?: React.CSSProperties;
        /** Secondary text shown beside {@link ListItem.label} (e.g. settings search group). */
        description?: string;
        /**
         * if true ignore all data and show line
         */
        divider?: boolean;
    };
    type ContextMenuData = {
        clickX: number;
        clickY: number;
        focusBackElem?: EventTarget | null;
        /**
         * leave extra space on left side, useful when have "check" items in list
         */
        padLeft?: boolean;
        items: Menu.ListItem[];
    };
    type OptSelectData = {
        items: Menu.ListItem[];
        onBlur?: (e: React.FocusEvent<HTMLDivElement, Element>) => void;
        focusBackElem?: HTMLElement | null;
        // display: boolean;
        elemBox: HTMLElement | { x: number; y: number; width: number } | null;
        /**
         * Keep keyboard focus on the trigger (usually a text input) so the user can
         * keep typing. Skips FocusLock / auto-focus; the list still receives clicks.
         */
        retainFocus?: boolean;
        /**
         * MenuList assigns move/select here while mounted. Filterable triggers use it
         * to highlight rows without replacing {@link OptSelectData} on every key.
         */
        navRef?: React.MutableRefObject<Menu.OptSelectNav | null>;
    };
    /** Imperative highlight control filled while the option list is mounted. */
    type OptSelectNav = {
        /** Shift highlight by `delta` rows (wraps; skips disabled). */
        move: (delta: number) => void;
        /** Activate the highlighted row. */
        select: () => void;
    };
    type OptSelectOption = {
        label: string;
        value: string;
        selected?: boolean;
        style?: React.CSSProperties;
    };
    type ColorSelectData = {
        value: Color;
        onChange: (color: Color) => void;
        onBlur?: (e: React.FocusEvent<HTMLDivElement, Element>) => void;
        focusBackElem?: HTMLElement | null;
        elemBox: HTMLElement | { x: number; y: number } | null;
        /**
         * @default true
         */
        showAlpha: boolean;
    };
}
