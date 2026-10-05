import type { ContextKind } from "@common/keybindings";
import { useCommandOwner } from "@features/keybindings";
import { isElementShown } from "@utils/utils";
import type { RefObject } from "react";

/**
 * Same-context rank for simultaneous search fields. Lower wins. Overlay / reader
 * / details also use distinct {@link ContextKind} values; these ranks separate
 * classic home split-pane fields that share `home`.
 */
export const PAGE_SEARCH_PRIORITY = {
    overlay: 0,
    reader: 1,
    details: 2,
    home: 3,
    homeFallback: 4,
    homeLast: 5,
} as const;

/**
 * Identity and context for a page-search field. Hidden chrome sets `enabled`
 * false (`visible: false`); do not use `available: false` for hidden fields.
 */
export type PageSearchTargetOptions = {
    /** Stable owner suffix; prefixed with `page-search:`. */
    id: string;
    contextKinds: readonly ContextKind[];
    /** Lower wins among same-context visible search owners. */
    tieOrder?: number;
    /** When false, this field is not a candidate. @default true */
    enabled?: boolean;
};

/** Focuses `el` and selects input/textarea contents. */
export const focusPageSearchField = (el: HTMLElement | null): boolean => {
    if (!el || !isElementShown(el)) return false;
    el.focus();
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.select();
    }
    return true;
};

/**
 * Registers `ref` as the `focusPageSearch` owner while mounted and enabled.
 */
export const usePageSearchFocus = (ref: RefObject<HTMLElement | null>, options: PageSearchTargetOptions): void => {
    const { id, contextKinds, tieOrder, enabled = true } = options;

    useCommandOwner({
        ownerId: `page-search:${id}`,
        contextKinds,
        visible: enabled,
        tieOrder,
        handlers: {
            focusPageSearch: () => {
                focusPageSearchField(ref.current);
            },
        },
    });
};
