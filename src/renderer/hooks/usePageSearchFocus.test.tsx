import ListNavigator from "@renderer/components/ListNavigator";
import { useAppSelector } from "@store/hooks";
import { getShortcutsMapped } from "@store/shortcuts";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent } from "@testing-library/react";
import { keyFormatter, SHORTCUT_COMMAND_MAP } from "@utils/keybindings";
import { type ReactElement, useEffect, useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
    clearPageSearchRegistry,
    dispatchFocusPageSearchShortcut,
    focusPrimaryPageSearch,
    hasPageSearchAtPriority,
    isPageSearchElementShown,
    PAGE_SEARCH_PRIORITY,
    registerPageSearch,
    tryFocusPrimaryPageSearch,
    usePageSearchFocus,
} from "./usePageSearchFocus";

const createdNodes: HTMLElement[] = [];

afterEach(() => {
    clearPageSearchRegistry();
    for (const el of createdNodes) el.remove();
    createdNodes.length = 0;
});

/**
 * jsdom does not apply stylesheets; tests that need "hidden" set inline display.
 */
const makeInput = (id: string, display = ""): HTMLInputElement => {
    const input = document.createElement("input");
    input.id = id;
    if (display) input.style.display = display;
    document.body.appendChild(input);
    createdNodes.push(input);
    return input;
};

/** Input nested under a parent so ancestor display/visibility can hide it. */
const makeWrappedInput = (id: string, parentStyle: Partial<CSSStyleDeclaration>): HTMLInputElement => {
    const wrap = document.createElement("div");
    Object.assign(wrap.style, parentStyle);
    const input = document.createElement("input");
    input.id = id;
    wrap.appendChild(input);
    document.body.appendChild(wrap);
    createdNodes.push(wrap);
    return input;
};

describe("page search registry", () => {
    it("focuses the highest-priority shown field and selects its value", () => {
        const low = makeInput("low");
        const high = makeInput("high");
        low.value = "keep";
        high.value = "pick";
        registerPageSearch({ id: "low", priority: PAGE_SEARCH_PRIORITY.homeLast, getElement: () => low });
        registerPageSearch({ id: "high", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => high });

        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(high);
        expect(high.selectionStart).toBe(0);
        expect(high.selectionEnd).toBe(high.value.length);
    });

    it("selects a textarea's contents when that field wins", () => {
        const ta = document.createElement("textarea");
        ta.id = "ta";
        ta.value = "query";
        document.body.appendChild(ta);
        createdNodes.push(ta);
        registerPageSearch({ id: "ta", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => ta });
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(ta);
        expect(ta.selectionStart).toBe(0);
        expect(ta.selectionEnd).toBe(ta.value.length);
    });

    it("skips display:none fields so a hidden toolbar loses to a shown one", () => {
        const hidden = makeInput("hidden", "none");
        const shown = makeInput("shown");
        registerPageSearch({
            id: "hidden",
            priority: PAGE_SEARCH_PRIORITY.home,
            getElement: () => hidden,
        });
        registerPageSearch({
            id: "shown",
            priority: PAGE_SEARCH_PRIORITY.homeLast,
            getElement: () => shown,
        });

        expect(isPageSearchElementShown(hidden)).toBe(false);
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(shown);
    });

    it("skips fields under a display:none or visibility:hidden ancestor", () => {
        const nestedHidden = makeWrappedInput("nested", { display: "none" });
        const visHidden = makeWrappedInput("vis", { visibility: "hidden" });
        const shown = makeInput("shown");
        registerPageSearch({
            id: "nested",
            priority: PAGE_SEARCH_PRIORITY.home,
            getElement: () => nestedHidden,
        });
        registerPageSearch({
            id: "vis",
            priority: PAGE_SEARCH_PRIORITY.home,
            getElement: () => visHidden,
        });
        registerPageSearch({ id: "shown", priority: PAGE_SEARCH_PRIORITY.homeLast, getElement: () => shown });

        expect(isPageSearchElementShown(nestedHidden)).toBe(false);
        expect(isPageSearchElementShown(visHidden)).toBe(false);
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(shown);
    });

    it("replacing a slot id uses the new element", () => {
        const first = makeInput("first");
        const second = makeInput("second");
        registerPageSearch({ id: "same", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => first });
        registerPageSearch({ id: "same", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => second });
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(second);
    });

    it("old unregister after id replace does not drop the new slot", () => {
        const first = makeInput("first");
        const second = makeInput("second");
        const unreg = registerPageSearch({
            id: "same",
            priority: PAGE_SEARCH_PRIORITY.home,
            getElement: () => first,
        });
        registerPageSearch({ id: "same", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => second });
        unreg();
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(second);
    });

    it("skips a disconnected element so a still-mounted field can win", () => {
        const gone = makeInput("gone");
        const shown = makeInput("shown");
        registerPageSearch({
            id: "gone",
            priority: PAGE_SEARCH_PRIORITY.overlay,
            getElement: () => gone,
        });
        registerPageSearch({ id: "shown", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => shown });
        gone.remove();
        expect(isPageSearchElementShown(gone)).toBe(false);
        expect(focusPrimaryPageSearch()).toBe(true);
        expect(document.activeElement).toBe(shown);
    });

    it("returns false when nothing is registered", () => {
        expect(focusPrimaryPageSearch()).toBe(false);
    });

    it("unregister stops a slot from winning", () => {
        const a = makeInput("a");
        const b = makeInput("b");
        const unreg = registerPageSearch({
            id: "a",
            priority: PAGE_SEARCH_PRIORITY.overlay,
            getElement: () => a,
        });
        registerPageSearch({ id: "b", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => b });
        unreg();
        focusPrimaryPageSearch();
        expect(document.activeElement).toBe(b);
    });

    it("tryFocusPrimaryPageSearch no-ops when settings are open and no overlay field exists", () => {
        const home = makeInput("home");
        registerPageSearch({ id: "home", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        expect(tryFocusPrimaryPageSearch(event, { settingsOpen: true })).toBe(false);
        expect(document.activeElement).not.toBe(home);
        expect(event.defaultPrevented).toBe(false);
    });

    it("treats a hidden overlay field as absent for the settings-open guard", () => {
        const home = makeInput("home-shown");
        const overlay = makeInput("overlay-hidden", "none");
        registerPageSearch({ id: "home-shown", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        registerPageSearch({
            id: "overlay-hidden",
            priority: PAGE_SEARCH_PRIORITY.overlay,
            getElement: () => overlay,
        });
        expect(hasPageSearchAtPriority(PAGE_SEARCH_PRIORITY.overlay)).toBe(false);
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        expect(tryFocusPrimaryPageSearch(event, { settingsOpen: true })).toBe(false);
        expect(document.activeElement).not.toBe(home);
    });

    it("tryFocusPrimaryPageSearch focuses when settings are closed", () => {
        const home = makeInput("home-closed");
        registerPageSearch({ id: "home-closed", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        expect(tryFocusPrimaryPageSearch(event, { settingsOpen: false })).toBe(true);
        expect(document.activeElement).toBe(home);
        expect(event.defaultPrevented).toBe(true);
    });

    it("does not preventDefault when no field can be focused", () => {
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        expect(tryFocusPrimaryPageSearch(event, { settingsOpen: false })).toBe(false);
        expect(event.defaultPrevented).toBe(false);
    });

    it("tryFocusPrimaryPageSearch focuses overlay search while settings are open", () => {
        const home = makeInput("home");
        const overlay = makeInput("overlay");
        registerPageSearch({ id: "home", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        registerPageSearch({
            id: "overlay",
            priority: PAGE_SEARCH_PRIORITY.overlay,
            getElement: () => overlay,
        });
        expect(hasPageSearchAtPriority(PAGE_SEARCH_PRIORITY.overlay)).toBe(true);
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        expect(tryFocusPrimaryPageSearch(event, { settingsOpen: true })).toBe(true);
        expect(document.activeElement).toBe(overlay);
    });

    it("dispatchFocusPageSearchShortcut does not preventDefault when the target already consumes typing", () => {
        const home = makeInput("home-typing");
        registerPageSearch({ id: "home-typing", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true });
        Object.defineProperty(event, "target", { value: home });
        expect(dispatchFocusPageSearchShortcut(event, { settingsOpen: false })).toBe(false);
        expect(event.defaultPrevented).toBe(false);
        expect(document.activeElement).not.toBe(home);
    });

    it("dispatchFocusPageSearchShortcut ignores key-repeat", () => {
        const home = makeInput("home-repeat");
        registerPageSearch({ id: "home-repeat", priority: PAGE_SEARCH_PRIORITY.home, getElement: () => home });
        const event = new KeyboardEvent("keydown", { key: "/", code: "Slash", cancelable: true, repeat: true });
        expect(dispatchFocusPageSearchShortcut(event, { settingsOpen: false })).toBe(false);
        expect(event.defaultPrevented).toBe(false);
    });
});

describe("usePageSearchFocus", () => {
    it("registers on mount and unregisters on unmount", () => {
        const Probe = () => {
            const ref = useRef<HTMLInputElement>(null);
            usePageSearchFocus(ref, { id: "probe", priority: PAGE_SEARCH_PRIORITY.home });
            return <input ref={ref} />;
        };

        const { unmount } = renderWithProviders(<Probe />);
        expect(focusPrimaryPageSearch()).toBe(true);
        unmount();
        expect(focusPrimaryPageSearch()).toBe(false);
    });

    it("does not register when enabled is false", () => {
        const Probe = ({ enabled }: { enabled: boolean }) => {
            const ref = useRef<HTMLInputElement>(null);
            usePageSearchFocus(ref, { id: "probe", priority: PAGE_SEARCH_PRIORITY.home, enabled });
            return <input ref={ref} />;
        };

        const { rerender, unmount } = renderWithProviders(<Probe enabled={false} />);
        expect(focusPrimaryPageSearch()).toBe(false);
        rerender(<Probe enabled />);
        expect(focusPrimaryPageSearch()).toBe(true);
        unmount();
    });
});

/**
 * Same command + input skip as App: {@link dispatchFocusPageSearchShortcut}.
 */
const FocusPageSearchDispatcher = ({ settingsOpen = false }: { settingsOpen?: boolean }) => {
    const shortcutsMapped = useAppSelector(getShortcutsMapped);
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const keyStr = keyFormatter(e);
            if (keyStr === "") return;
            if (!shortcutsMapped.focusPageSearch?.includes(keyStr)) return;
            dispatchFocusPageSearchShortcut(e, { settingsOpen });
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [settingsOpen, shortcutsMapped]);
    return null;
};

/** Fresh keymap so tests do not depend on the developer machine's shortcuts.json. */
const defaultShortcutsState = SHORTCUT_COMMAND_MAP.map((e) => ({
    command: e.command,
    keys: e.defaultKeys,
}));

const renderWithFocusSearch = (ui: ReactElement) =>
    renderWithProviders(ui, { preloadedState: { shortcuts: defaultShortcutsState } });

describe("focusPageSearch shortcut", () => {
    it("focuses the higher-priority ListNavigator search, not the fallback", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "locations", priority: PAGE_SEARCH_PRIORITY.homeLast }}
                    />
                </ListNavigator.Provider>
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const inputs = document.querySelectorAll("input.search-input");
        expect(inputs.length).toBe(2);
        const historyInput = inputs[1] as HTMLInputElement;
        const locationsInput = inputs[0] as HTMLInputElement;
        historyInput.blur();
        locationsInput.blur();
        document.body.focus();

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "/",
                    code: "Slash",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(document.activeElement).toBe(historyInput);
    });

    it("focuses the fallback SearchInput when the primary is not mounted", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "locations", priority: PAGE_SEARCH_PRIORITY.homeLast }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const locationsInput = document.querySelector("input.search-input") as HTMLInputElement;
        locationsInput.blur();
        document.body.focus();

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "/",
                    code: "Slash",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(document.activeElement).toBe(locationsInput);
    });

    it("does not treat ctrl+slash as focusPageSearch", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const historyInput = document.querySelector("input.search-input") as HTMLInputElement;
        historyInput.blur();
        document.body.focus();

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "/",
                    code: "Slash",
                    ctrlKey: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(document.activeElement).not.toBe(historyInput);
    });

    it("ctrl+shift+f focuses the same primary field as slash", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const historyInput = document.querySelector("input.search-input") as HTMLInputElement;
        historyInput.blur();
        document.body.focus();

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "F",
                    code: "KeyF",
                    ctrlKey: true,
                    shiftKey: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(document.activeElement).toBe(historyInput);
    });

    it("does not steal slash while a search input is focused", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "locations", priority: PAGE_SEARCH_PRIORITY.homeLast }}
                    />
                </ListNavigator.Provider>
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const inputs = document.querySelectorAll("input.search-input");
        const locationsInput = inputs[0] as HTMLInputElement;
        const historyInput = inputs[1] as HTMLInputElement;
        locationsInput.focus();
        fireEvent.keyDown(locationsInput, { key: "/", code: "Slash" });
        expect(document.activeElement).toBe(locationsInput);
        expect(document.activeElement).not.toBe(historyInput);
    });

    it("does not steal ctrl+shift+f while a search input is focused", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher />
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "locations", priority: PAGE_SEARCH_PRIORITY.homeLast }}
                    />
                </ListNavigator.Provider>
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const inputs = document.querySelectorAll("input.search-input");
        const locationsInput = inputs[0] as HTMLInputElement;
        const historyInput = inputs[1] as HTMLInputElement;
        locationsInput.focus();
        fireEvent.keyDown(locationsInput, { key: "F", code: "KeyF", ctrlKey: true, shiftKey: true });
        expect(document.activeElement).toBe(locationsInput);
        expect(document.activeElement).not.toBe(historyInput);
    });

    it("does not focus home search through the dispatcher while settings are open", () => {
        renderWithFocusSearch(
            <>
                <FocusPageSearchDispatcher settingsOpen />
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={{ id: "history", priority: PAGE_SEARCH_PRIORITY.home }}
                    />
                </ListNavigator.Provider>
            </>,
        );

        const historyInput = document.querySelector("input.search-input") as HTMLInputElement;
        historyInput.blur();
        document.body.focus();

        act(() => {
            window.dispatchEvent(
                new KeyboardEvent("keydown", {
                    key: "/",
                    code: "Slash",
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(document.activeElement).not.toBe(historyInput);
    });
});
