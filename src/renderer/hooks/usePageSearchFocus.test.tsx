import { useCommandOwner } from "@features/keybindings";
import ListNavigator from "@renderer/components/ListNavigator";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent } from "@testing-library/react";
import { isElementShown } from "@utils/utils";
import { type ReactElement, useRef } from "react";
import { describe, expect, it } from "vitest";
import { PAGE_SEARCH_PRIORITY, usePageSearchFocus } from "./usePageSearchFocus";

const homeSearch = (id: string, tieOrder: number) => ({
    id,
    contextKinds: ["home"] as const,
    tieOrder,
});

/** Catalog defaults from the shortcuts slice; ingress is {@link KeybindingProvider}. */
const renderWithFocusSearch = (ui: ReactElement) => renderWithProviders(ui);

const pressSlash = (): void => {
    window.dispatchEvent(
        new KeyboardEvent("keydown", {
            key: "/",
            code: "Slash",
            bubbles: true,
            cancelable: true,
        }),
    );
};

describe("usePageSearchFocus", () => {
    it("focuses the registered field on Slash and unregisters on unmount", () => {
        const Probe = () => {
            const ref = useRef<HTMLInputElement>(null);
            usePageSearchFocus(ref, homeSearch("probe", PAGE_SEARCH_PRIORITY.home));
            return <input ref={ref} />;
        };

        const { unmount, container } = renderWithProviders(<Probe />);
        const input = container.querySelector("input");
        expect(input).toBeTruthy();
        act(() => pressSlash());
        expect(document.activeElement).toBe(input);
        unmount();
        act(() => pressSlash());
        expect(document.activeElement).not.toBe(input);
    });

    it("does not register when enabled is false", () => {
        const Probe = ({ enabled }: { enabled: boolean }) => {
            const ref = useRef<HTMLInputElement>(null);
            usePageSearchFocus(ref, { ...homeSearch("probe-en", PAGE_SEARCH_PRIORITY.home), enabled });
            return <input ref={ref} />;
        };

        const { rerender, container } = renderWithProviders(<Probe enabled={false} />);
        const input = container.querySelector("input");
        act(() => pressSlash());
        expect(document.activeElement).not.toBe(input);
        rerender(<Probe enabled />);
        act(() => pressSlash());
        expect(document.activeElement).toBe(container.querySelector("input"));
    });
});

describe("focusPageSearch shortcut", () => {
    it("focuses the higher-priority ListNavigator search, not the fallback", () => {
        renderWithFocusSearch(
            <>
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={homeSearch("locations", PAGE_SEARCH_PRIORITY.homeLast)}
                    />
                </ListNavigator.Provider>
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput pageSearch={homeSearch("history", PAGE_SEARCH_PRIORITY.home)} />
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

        act(() => pressSlash());

        expect(document.activeElement).toBe(historyInput);
    });

    it("focuses the fallback SearchInput when the primary is not mounted", () => {
        renderWithFocusSearch(
            <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                <ListNavigator.SearchInput pageSearch={homeSearch("locations", PAGE_SEARCH_PRIORITY.homeLast)} />
            </ListNavigator.Provider>,
        );

        const locationsInput = document.querySelector("input.search-input") as HTMLInputElement;
        locationsInput.blur();
        document.body.focus();

        act(() => pressSlash());

        expect(document.activeElement).toBe(locationsInput);
    });

    it("does not treat ctrl+slash as focusPageSearch", () => {
        renderWithFocusSearch(
            <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                <ListNavigator.SearchInput pageSearch={homeSearch("history", PAGE_SEARCH_PRIORITY.home)} />
            </ListNavigator.Provider>,
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
            <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                <ListNavigator.SearchInput pageSearch={homeSearch("history", PAGE_SEARCH_PRIORITY.home)} />
            </ListNavigator.Provider>,
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
                <ListNavigator.Provider items={["loc"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput
                        pageSearch={homeSearch("locations", PAGE_SEARCH_PRIORITY.homeLast)}
                    />
                </ListNavigator.Provider>
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput pageSearch={homeSearch("history", PAGE_SEARCH_PRIORITY.home)} />
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
        expect(isElementShown(locationsInput)).toBe(true);
    });

    it("does not focus home search while Settings is open", () => {
        const SettingsBlock = () => {
            useCommandOwner({
                ownerId: "settings",
                contextKinds: ["settings"],
                visible: true,
                handlers: {},
            });
            return null;
        };
        renderWithFocusSearch(
            <>
                <SettingsBlock />
                <ListNavigator.Provider items={["hist"]} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput pageSearch={homeSearch("history", PAGE_SEARCH_PRIORITY.home)} />
                </ListNavigator.Provider>
            </>,
        );

        const historyInput = document.querySelector("input.search-input") as HTMLInputElement;
        historyInput.blur();
        document.body.focus();

        act(() => pressSlash());

        expect(document.activeElement).not.toBe(historyInput);
    });
});
