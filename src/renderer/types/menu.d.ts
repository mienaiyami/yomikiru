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
