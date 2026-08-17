import { faXmark } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useAppContext } from "@renderer/App";
import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { keyFormatter } from "@utils/keybindings";
import type React from "react";
import { type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { shallowEqual } from "react-redux";

/** One row in {@link Combobox}, same shape as {@link Menu.OptSelectOption} plus optional description. */
export type ComboboxOption = {
    value: string;
    label: string;
    /** Secondary text shown beside {@link ComboboxOption.label} in the MenuList row. */
    description?: string;
    disabled?: boolean;
};

/**
 * Filterable text field that shows matches in the shared {@link MenuList} via
 * {@link Menu.OptSelectData} (same path as {@link InputSelect}). Keeps focus on
 * the input ({@link Menu.OptSelectData.retainFocus}) so typing is not stolen.
 * Keydown is stopped from bubbling like other Input* fields so window shortcuts
 * do not fire while typing.
 *
 * Arrow highlight stays in MenuList local state ({@link Menu.OptSelectNav});
 * replacing AppContext on every key-repeat would re-render the tree and skip rows.
 */
const Combobox: React.FC<{
    value: string;
    onChange: (value: string) => void;
    options: readonly ComboboxOption[];
    onSelect: (value: string) => void;
    placeholder?: string;
    /** Accessible name; defaults to placeholder. */
    "aria-label"?: string;
    /** MenuList row when {@link Combobox} `options` is empty and the query is non-empty. */
    emptyMessage?: string;
    /**
     * Escape with an empty value (list already closed). Escape with a non-empty
     * value clears the field instead.
     */
    onDismiss?: () => void;
    className?: string;
    disabled?: boolean;
    /** Ref to the text input (e.g. page-search focus registration). */
    inputRef?: RefObject<HTMLInputElement | null>;
}> = ({
    value,
    onChange,
    options,
    onSelect,
    placeholder,
    "aria-label": ariaLabel,
    emptyMessage,
    onDismiss,
    className = "",
    disabled = false,
    inputRef: inputRefProp,
}) => {
    const { t } = useTranslation("common");
    const { setOptSelectData } = useAppContext();
    const shortcutsMapped = useAppSelector(getShortcutsMapped, shallowEqual);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const navRef = useRef<Menu.OptSelectNav | null>(null);
    /** Fallback highlight when MenuList is not mounted (tests). */
    const highlightRef = useRef(0);
    const [menuRev, setMenuRev] = useState(0);

    const trimmed = value.trim();
    const listOpen = trimmed.length > 0;
    const optionKey = options.map((o) => o.value).join("\0");

    const optionsRef = useRef(options);
    optionsRef.current = options;
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const emptyMessageRef = useRef(emptyMessage);
    emptyMessageRef.current = emptyMessage;

    const closeList = () => setOptSelectData(null);

    const selectValue = (next: string) => {
        onSelectRef.current(next);
        onChangeRef.current("");
        highlightRef.current = 0;
        setOptSelectData(null);
    };

    /**
     * Moves highlight without republishing {@link Menu.OptSelectData}.
     */
    const stepHighlight = (delta: number) => {
        if (navRef.current) {
            navRef.current.move(delta);
            return;
        }
        const opts = optionsRef.current;
        const len = opts.length;
        if (len === 0) return;
        let next = highlightRef.current;
        for (let n = 0; n < len; n++) {
            next = (next + delta + len) % len;
            if (!opts[next]?.disabled) {
                highlightRef.current = next;
                return;
            }
        }
    };

    const prevOptionKeyRef = useRef(optionKey);

    // menuRev is a focus-reopen nonce; optionKey retriggers when the match set changes
    useLayoutEffect(() => {
        void menuRev;
        const el = inputRef.current;
        if (!listOpen || !el) {
            setOptSelectData(null);
            return;
        }
        if (prevOptionKeyRef.current !== optionKey) {
            prevOptionKeyRef.current = optionKey;
            highlightRef.current = 0;
        }
        const opts = optionsRef.current;
        const items: Menu.ListItem[] =
            opts.length === 0
                ? [
                      {
                          label: emptyMessageRef.current ?? "",
                          action: () => undefined,
                          disabled: true,
                      },
                  ]
                  : opts.map((opt, i) => ({
                      label: opt.label,
                      description: opt.description,
                      selected: i === 0,
                      disabled: opt.disabled,
                      action: () => {
                          if (opt.disabled) return;
                          onSelectRef.current(opt.value);
                          onChangeRef.current("");
                          highlightRef.current = 0;
                          setOptSelectData(null);
                      },
                  }));
        setOptSelectData({
            items,
            elemBox: el,
            focusBackElem: el,
            retainFocus: true,
            navRef,
            onBlur: () => setOptSelectData(null),
        });
    }, [listOpen, optionKey, menuRev, setOptSelectData]);

    useEffect(() => () => setOptSelectData(null), [setOptSelectData]);

    const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.stopPropagation();
        const keyStr = keyFormatter(e);
        if (keyStr === "" && e.key !== "Escape") return;

        if (e.key === "Escape") {
            e.preventDefault();
            if (trimmed !== "") {
                onChange("");
                highlightRef.current = 0;
                closeList();
                return;
            }
            closeList();
            onDismiss?.();
            return;
        }

        if (!listOpen) return;

        if (shortcutsMapped.listDown.includes(keyStr)) {
            e.preventDefault();
            stepHighlight(1);
            return;
        }
        if (shortcutsMapped.listUp.includes(keyStr)) {
            e.preventDefault();
            stepHighlight(-1);
            return;
        }
        if (shortcutsMapped.listSelect.includes(keyStr)) {
            e.preventDefault();
            if (navRef.current) {
                navRef.current.select();
                return;
            }
            const hit = options[highlightRef.current] ?? options[0];
            if (hit && !hit.disabled) selectValue(hit.value);
        }
    };

    return (
        <div className={`search-input-wrapper ${className}`.trim()}>
            <input
                ref={(node) => {
                    inputRef.current = node;
                    if (inputRefProp) (inputRefProp as React.MutableRefObject<HTMLInputElement | null>).current = node;
                }}
                type="text"
                className="search-input"
                value={value}
                placeholder={placeholder}
                aria-label={ariaLabel ?? placeholder}
                autoComplete="off"
                spellCheck={false}
                disabled={disabled}
                onChange={(e) => {
                    highlightRef.current = 0;
                    onChange(e.currentTarget.value);
                }}
                onKeyDown={onKeyDown}
                onFocus={() => {
                    if (listOpen) setMenuRev((n) => n + 1);
                }}
                onBlur={() => {
                    // list mousedown preventDefault keeps focus; real blur means click-away
                    closeList();
                }}
                onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                }}
            />
            {trimmed !== "" && (
                <button
                    type="button"
                    className="search-input-clear"
                    aria-label={t("list.clearSearch")}
                    tabIndex={-1}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                        onChange("");
                        highlightRef.current = 0;
                        closeList();
                        inputRef.current?.focus();
                    }}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            )}
        </div>
    );
};

export default Combobox;
