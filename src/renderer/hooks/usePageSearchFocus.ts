import { isShortcutEventFromInputTarget } from "@utils/keybindings";
import { type RefObject, useEffect } from "react";

/**
 * Relative ranks for {@link registerPageSearch}. Higher wins when more than one
 * field is mounted. Values are ordered by UI layer (overlay above reader above
 * nested chrome above the home shell), not by today's page names.
 */
export const PAGE_SEARCH_PRIORITY = {
    overlay: 100,
    reader: 50,
    details: 40,
    home: 20,
    homeFallback: 10,
    homeLast: 5,
} as const;

/**
 * Identity and rank for a page-search field. `enabled` false means the field is
 * not a candidate (e.g. a still-mounted but hidden toolbar).
 */
export type PageSearchTargetOptions = {
    id: string;
    priority: number;
    /** When false, this field is not a candidate. @default true */
    enabled?: boolean;
};

type PageSearchSlot = {
    id: string;
    priority: number;
    getElement: () => HTMLElement | null;
};

const slots = new Map<string, PageSearchSlot>();

/**
 * True when the element is in the document and not under `display:none` /
 * `visibility:hidden`. Used so a CSS-hidden toolbar loses to a visible details
 * field, and so `display:none` home does not steal focus from the reader.
 */
export const isPageSearchElementShown = (el: HTMLElement): boolean => {
    if (!el.isConnected) return false;
    let node: HTMLElement | null = el;
    while (node) {
        const style = getComputedStyle(node);
        if (style.display === "none" || style.visibility === "hidden") return false;
        node = node.parentElement;
    }
    return true;
};

const usableElement = (el: HTMLElement | null): HTMLElement | null => {
    if (!el || !isPageSearchElementShown(el)) return null;
    return el;
};

/**
 * Registers a focus target for {@link focusPrimaryPageSearch}. Returns an
 * unregister function; a later register with the same `id` replaces this slot.
 */
export const registerPageSearch = (slot: PageSearchSlot): (() => void) => {
    slots.set(slot.id, slot);
    return () => {
        if (slots.get(slot.id) === slot) slots.delete(slot.id);
    };
};

/**
 * True when a registered slot at `priority` currently has a shown element.
 * App uses this so Settings-open does not focus home search until an overlay
 * field (settings search, later) is registered.
 */
export const hasPageSearchAtPriority = (priority: number): boolean => {
    for (const slot of slots.values()) {
        if (slot.priority !== priority) continue;
        if (usableElement(slot.getElement())) return true;
    }
    return false;
};

/**
 * Focuses the highest-priority shown search field and selects its contents.
 *
 * @returns whether a field was focused
 */
export const focusPrimaryPageSearch = (): boolean => {
    const ordered = [...slots.values()].sort((a, b) => b.priority - a.priority);
    for (const slot of ordered) {
        const el = usableElement(slot.getElement());
        if (!el) continue;
        el.focus();
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
            el.select();
        }
        return true;
    }
    return false;
};

type TryFocusOptions = {
    /** When true, skip focusing unless an overlay-priority field is shown. */
    settingsOpen: boolean;
};

/**
 * Shortcut handler body for the page-search command: no-op while Settings is
 * open and no overlay search is registered; otherwise focuses the primary field.
 * Callers must skip events whose target already consumes typing.
 * {@link Event.preventDefault} runs only after a field is focused, so a no-op
 * still lets the keystroke type.
 *
 * @returns whether a field was focused
 */
export const tryFocusPrimaryPageSearch = (e: Event, options: TryFocusOptions): boolean => {
    if (options.settingsOpen && !hasPageSearchAtPriority(PAGE_SEARCH_PRIORITY.overlay)) {
        return false;
    }
    const focused = focusPrimaryPageSearch();
    if (focused) {
        e.preventDefault();
    }
    return focused;
};

/**
 * App's focusPageSearch window-shortcut case: skip key-repeat and events whose
 * target already consumes typing, then {@link tryFocusPrimaryPageSearch}.
 *
 * @returns whether a field was focused
 */
export const dispatchFocusPageSearchShortcut = (e: Event, options: TryFocusOptions): boolean => {
    // held key would keep re-selecting the field
    if (e instanceof KeyboardEvent && e.repeat) return false;
    if (isShortcutEventFromInputTarget(e)) return false;
    return tryFocusPrimaryPageSearch(e, options);
};

/**
 * Drops every registered slot. Production code unregisters on unmount; tests
 * call this between cases so module state does not leak.
 */
export const clearPageSearchRegistry = (): void => {
    slots.clear();
};

/**
 * Registers `ref` as a page-search target while the caller is mounted and
 * `enabled` is true. Unregisters on unmount or when `enabled` becomes false.
 */
export const usePageSearchFocus = (ref: RefObject<HTMLElement | null>, options: PageSearchTargetOptions): void => {
    const { id, priority, enabled = true } = options;

    useEffect(() => {
        if (!enabled || !id) return;
        return registerPageSearch({
            id,
            priority,
            getElement: () => ref.current,
        });
    }, [enabled, id, priority, ref]);
};
