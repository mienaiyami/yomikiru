import { isPageSearchElementShown } from "@hooks/usePageSearchFocus";
import type { AppDispatch } from "@store/index";
import { requestSettingsNav } from "@store/ui";
import { createRendererLogger } from "@utils/logger";
import {
    getSettingsTarget,
    SETTINGS_TARGET_HIGHLIGHT_CLASS,
    SETTINGS_TARGET_HIGHLIGHT_MS,
} from "./settingsTargets";

const log = createRendererLogger("settings/navigate");

/** Max frames to wait for a CSS-hidden tab panel to show its target. */
const WAIT_MAX_FRAMES = 60;

/**
 * Opens Settings if needed and queues navigation to a catalog target id.
 * {@link Settings} applies the pending request (tab + scroll + highlight + focus).
 * Safe when Settings is already open: a new `requestId` retriggers apply.
 */
export const navigateToSetting = (id: string, dispatch: AppDispatch): void => {
    if (!getSettingsTarget(id)) {
        log.error("navigateToSetting: unknown target id", { id });
        return;
    }
    dispatch(requestSettingsNav(id));
};

/**
 * Resolves `selector` when the element exists, is connected under `#settings`,
 * and is shown (not under `display:none`). Polls with `requestAnimationFrame`
 * after a tab switch.
 *
 * @returns the element, or `null` if not found within {@link WAIT_MAX_FRAMES}
 */
export const waitForSettingsTargetElement = (selector: string): Promise<HTMLElement | null> =>
    new Promise((resolve) => {
        let frames = 0;
        const tick = () => {
            const root = document.querySelector("#settings");
            const el = root?.querySelector(selector) ?? null;
            if (el instanceof HTMLElement && isPageSearchElementShown(el)) {
                resolve(el);
                return;
            }
            frames += 1;
            if (frames >= WAIT_MAX_FRAMES) {
                resolve(null);
                return;
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });

/** Buttons, fields, and tabbable nodes (not in-app `<a>` without href). */
const SETTINGS_TARGET_CONTROL_SELECTOR = [
    "button:not([disabled])",
    "input:not([disabled]):not([type='hidden'])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * True when `el` is shown and not disabled. Used to skip hidden tab panels and
 * disabled toggle labels.
 */
const isUsableFocusTarget = (el: HTMLElement): boolean => {
    if (!isPageSearchElementShown(el)) return false;
    if (el.closest("[disabled], [aria-disabled='true'], label.disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
};

/**
 * First keyboard landing node in `root`: the root when it is a control (or an
 * in-app `<a>` that is the catalog target), otherwise the first descendant
 * button / field / tabbable. Descendant `<a>` without href are skipped so
 * "more info" links do not steal focus from the setting control.
 */
export const firstFocusableInSettingsTarget = (root: HTMLElement): HTMLElement | null => {
    if (isUsableFocusTarget(root) && (root.matches(SETTINGS_TARGET_CONTROL_SELECTOR) || root.matches("a"))) {
        return root;
    }
    for (const el of root.querySelectorAll<HTMLElement>(SETTINGS_TARGET_CONTROL_SELECTOR)) {
        if (isUsableFocusTarget(el)) return el;
    }
    return null;
};

/**
 * Moves keyboard focus into `root`. Non-tabbable nodes get `tabindex="-1"` so
 * {@link HTMLElement.focus} can land there (same pattern as the overlay body).
 */
export const focusSettingsTargetElement = (root: HTMLElement): void => {
    const control = firstFocusableInSettingsTarget(root) ?? root;
    if (!control.matches(SETTINGS_TARGET_CONTROL_SELECTOR) && !control.hasAttribute("tabindex")) {
        control.tabIndex = -1;
    }
    control.focus({ preventScroll: true });
};

/**
 * Scrolls `elem` into view, applies {@link SETTINGS_TARGET_HIGHLIGHT_CLASS}
 * for {@link SETTINGS_TARGET_HIGHLIGHT_MS}, and moves keyboard focus into the
 * target via {@link focusSettingsTargetElement}. Returns a cancel function for
 * the highlight timeout (call on unmount or next navigate).
 */
export const highlightSettingsTargetElement = (elem: HTMLElement): (() => void) => {
    // chrome 108 ScrollBehavior is only auto|smooth (instant is newer)
    elem.scrollIntoView({ block: "start", behavior: "auto" });
    elem.classList.add(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    focusSettingsTargetElement(elem);
    const timer = window.setTimeout(() => {
        elem.classList.remove(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    }, SETTINGS_TARGET_HIGHLIGHT_MS);
    return () => {
        window.clearTimeout(timer);
        elem.classList.remove(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    };
};
