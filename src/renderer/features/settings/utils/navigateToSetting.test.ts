import { configureStore } from "@reduxjs/toolkit";
import uiReducer, {
    clearPendingSettingsNav,
    requestSettingsNav,
    setSettingsOpen,
    toggleSettingsOpen,
} from "@store/ui";
import { describe, expect, it, vi } from "vitest";
import {
    firstFocusableInSettingsTarget,
    focusSettingsTargetElement,
    highlightSettingsTargetElement,
    navigateToSetting,
    waitForSettingsTargetElement,
} from "./navigateToSetting";
import { SETTINGS_TARGET_HIGHLIGHT_CLASS, SETTINGS_TARGET_HIGHLIGHT_MS } from "./settingsTargets";

/**
 * Minimal store with only the ui slice for navigate / pending-nav tests.
 */
const createUiStore = () =>
    configureStore({
        reducer: { ui: uiReducer },
    });

describe("ui pendingSettingsNav", () => {
    it("requestSettingsNav opens settings and sets pending id", () => {
        const store = createUiStore();
        store.dispatch(requestSettingsNav("setting:library"));
        const ui = store.getState().ui;
        expect(ui.isOpen.settings).toBe(true);
        expect(ui.pendingSettingsNav?.id).toBe("setting:library");
        expect(ui.pendingSettingsNav?.requestId).toBe(1);
    });

    it("bumps requestId when navigating to the same id again", () => {
        const store = createUiStore();
        store.dispatch(requestSettingsNav("setting:library"));
        const first = store.getState().ui.pendingSettingsNav!.requestId;
        store.dispatch(requestSettingsNav("setting:library"));
        expect(store.getState().ui.pendingSettingsNav?.requestId).toBe(first + 1);
    });

    it("clears pending when settings close or toggle closed", () => {
        const store = createUiStore();
        store.dispatch(requestSettingsNav("about"));
        store.dispatch(setSettingsOpen(false));
        expect(store.getState().ui.pendingSettingsNav).toBeNull();

        store.dispatch(requestSettingsNav("about"));
        store.dispatch(toggleSettingsOpen());
        expect(store.getState().ui.isOpen.settings).toBe(false);
        expect(store.getState().ui.pendingSettingsNav).toBeNull();
    });

    it("clearPendingSettingsNav drops the pending request", () => {
        const store = createUiStore();
        store.dispatch(requestSettingsNav("setting:pdf"));
        store.dispatch(clearPendingSettingsNav());
        expect(store.getState().ui.pendingSettingsNav).toBeNull();
        expect(store.getState().ui.isOpen.settings).toBe(true);
    });
});

describe("navigateToSetting", () => {
    it("dispatches requestSettingsNav for a known catalog id", () => {
        const dispatch = vi.fn();
        navigateToSetting("setting:library", dispatch);
        expect(dispatch).toHaveBeenCalledWith(requestSettingsNav("setting:library"));
    });

    it("does not dispatch for an unknown id", () => {
        const dispatch = vi.fn();
        navigateToSetting("nope:missing", dispatch);
        expect(dispatch).not.toHaveBeenCalled();
    });
});

describe("waitForSettingsTargetElement", () => {
    it("resolves an element that is shown under #settings", async () => {
        const root = document.createElement("div");
        root.id = "settings";
        const target = document.createElement("div");
        target.id = "settings-library";
        root.appendChild(target);
        document.body.appendChild(root);

        const found = await waitForSettingsTargetElement("#settings-library");
        expect(found).toBe(target);

        root.remove();
    });

    it("ignores matches outside #settings and returns null after timeout", async () => {
        vi.stubGlobal(
            "requestAnimationFrame",
            (cb: FrameRequestCallback) => window.setTimeout(() => cb(0), 0) as unknown as number,
        );
        const orphan = document.createElement("div");
        orphan.id = "settings-library";
        document.body.appendChild(orphan);

        const found = await waitForSettingsTargetElement("#settings-library");
        expect(found).toBeNull();

        orphan.remove();
        vi.unstubAllGlobals();
    });
});

describe("highlightSettingsTargetElement", () => {
    it("scrolls, applies highlight class, and cancel removes it early", () => {
        vi.useFakeTimers();
        const elem = document.createElement("div");
        elem.scrollIntoView = vi.fn();
        document.body.appendChild(elem);

        const cancel = highlightSettingsTargetElement(elem);
        expect(elem.scrollIntoView).toHaveBeenCalled();
        expect(elem.classList.contains(SETTINGS_TARGET_HIGHLIGHT_CLASS)).toBe(true);
        expect(document.activeElement).toBe(elem);

        cancel();
        expect(elem.classList.contains(SETTINGS_TARGET_HIGHLIGHT_CLASS)).toBe(false);

        elem.remove();
        vi.useRealTimers();
    });

    it("removes highlight class after the highlight duration", () => {
        vi.useFakeTimers();
        const elem = document.createElement("div");
        elem.scrollIntoView = vi.fn();
        document.body.appendChild(elem);

        highlightSettingsTargetElement(elem);
        expect(elem.classList.contains(SETTINGS_TARGET_HIGHLIGHT_CLASS)).toBe(true);
        vi.advanceTimersByTime(SETTINGS_TARGET_HIGHLIGHT_MS);
        expect(elem.classList.contains(SETTINGS_TARGET_HIGHLIGHT_CLASS)).toBe(false);

        elem.remove();
        vi.useRealTimers();
    });
});

describe("firstFocusableInSettingsTarget", () => {
    it("prefers a descendant button over an in-app more-info link", () => {
        const root = document.createElement("div");
        const link = document.createElement("a");
        const btn = document.createElement("button");
        root.append(link, btn);
        document.body.appendChild(root);
        expect(firstFocusableInSettingsTarget(root)).toBe(btn);
        root.remove();
    });

    it("returns the root when it is the catalog target anchor", () => {
        const link = document.createElement("a");
        document.body.appendChild(link);
        expect(firstFocusableInSettingsTarget(link)).toBe(link);
        link.remove();
    });

    it("returns a tabindex=0 toggle before a sibling checkbox", () => {
        const root = document.createElement("div");
        const toggle = document.createElement("span");
        toggle.tabIndex = 0;
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        root.append(toggle, checkbox);
        document.body.appendChild(root);
        expect(firstFocusableInSettingsTarget(root)).toBe(toggle);
        root.remove();
    });

    it("skips a disabled button for a later enabled one", () => {
        const root = document.createElement("div");
        const disabled = document.createElement("button");
        disabled.disabled = true;
        const enabled = document.createElement("button");
        root.append(disabled, enabled);
        document.body.appendChild(root);
        expect(firstFocusableInSettingsTarget(root)).toBe(enabled);
        root.remove();
    });
});

describe("focusSettingsTargetElement", () => {
    it("moves focus from another field onto the first control", () => {
        const search = document.createElement("input");
        const root = document.createElement("div");
        const btn = document.createElement("button");
        root.appendChild(btn);
        document.body.append(search, root);
        search.focus();
        expect(document.activeElement).toBe(search);
        focusSettingsTargetElement(root);
        expect(document.activeElement).toBe(btn);
        search.remove();
        root.remove();
    });

    it("lands on a wrapper with no controls via tabindex -1", () => {
        const root = document.createElement("div");
        document.body.appendChild(root);
        focusSettingsTargetElement(root);
        expect(root.getAttribute("tabindex")).toBe("-1");
        expect(document.activeElement).toBe(root);
        root.remove();
    });
});
