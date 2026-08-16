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
 * {@link Settings} applies the pending request (tab + scroll + highlight).
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

/**
 * Scrolls `elem` into view and applies {@link SETTINGS_TARGET_HIGHLIGHT_CLASS}
 * for {@link SETTINGS_TARGET_HIGHLIGHT_MS}. Returns a cancel function for the
 * highlight timeout (call on unmount or next navigate).
 */
export const highlightSettingsTargetElement = (elem: HTMLElement): (() => void) => {
    // chrome 108 ScrollBehavior is only auto|smooth (instant is newer)
    elem.scrollIntoView({ block: "start", behavior: "auto" });
    elem.classList.add(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    const timer = window.setTimeout(() => {
        elem.classList.remove(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    }, SETTINGS_TARGET_HIGHLIGHT_MS);
    return () => {
        window.clearTimeout(timer);
        elem.classList.remove(SETTINGS_TARGET_HIGHLIGHT_CLASS);
    };
};
