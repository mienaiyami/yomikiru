import settings from "@common/i18n/locales/en/settings.json";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SettingsSearch from "./SettingsSearch";

const navigateToSetting = vi.fn();

vi.mock("../utils/navigateToSetting", () => ({
    navigateToSetting: (...args: unknown[]) => navigateToSetting(...args),
}));

const { setOptSelectData } = vi.hoisted(() => ({
    setOptSelectData: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ setOptSelectData }),
}));

/** Settings open, no pending navigate. */
const openSettingsState = {
    ui: {
        isOpen: { settings: true, anilist: { login: false, search: false, edit: false } },
        pendingSettingsNav: null,
    },
} as const;

/** Last non-null menu payload passed to {@link setOptSelectData}. */
const lastMenu = (): Menu.OptSelectData | null => {
    for (let i = setOptSelectData.mock.calls.length - 1; i >= 0; i--) {
        const arg = setOptSelectData.mock.calls[i]?.[0];
        if (arg && typeof arg === "object" && "items" in arg) return arg as Menu.OptSelectData;
    }
    return null;
};

describe("SettingsSearch", () => {
    afterEach(() => {
        cleanup();
        navigateToSetting.mockClear();
        setOptSelectData.mockClear();
    });

    it("does not open MenuList until the query is non-empty", () => {
        renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        expect(lastMenu()).toBeNull();
        fireEvent.change(screen.getByPlaceholderText(settings.search.placeholder), {
            target: { value: "library" },
        });
        expect(screen.getByPlaceholderText(settings.search.placeholder)).toHaveValue("library");
    });

    it("matches section body copy (AniList auto-update)", () => {
        renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        fireEvent.change(screen.getByPlaceholderText(settings.search.placeholder), {
            target: { value: "auto-update" },
        });
        const menu = lastMenu();
        expect(menu?.items.some((item) => item.label.includes(settings.anilist.title))).toBe(true);
    });

    it("jumps to an Other Settings control instead of the section heading", () => {
        renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        fireEvent.change(screen.getByPlaceholderText(settings.search.placeholder), {
            target: { value: "hardware acceleration" },
        });
        const menu = lastMenu();
        const hardware = menu?.items.find((item) => item.label === settings.otherSettings.hardwareAcceleration);
        expect(hardware).toBeDefined();
        expect(hardware?.description).toBe(settings.otherSettings.title);
        expect(menu?.items.some((item) => item.label === settings.otherSettings.title)).toBe(false);
    });

    it("navigates on MenuList item action and clears the query", () => {
        renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        const input = screen.getByPlaceholderText(settings.search.placeholder);
        fireEvent.change(input, { target: { value: "library" } });
        lastMenu()
            ?.items.find((item) => item.label.includes(settings.library.title))
            ?.action();
        expect(navigateToSetting).toHaveBeenCalledWith("setting:library", expect.anything());
        expect(input).toHaveValue("");
    });

    it("navigates the active hit on Enter", () => {
        renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        const input = screen.getByPlaceholderText(settings.search.placeholder);
        fireEvent.change(input, { target: { value: "library" } });
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        expect(navigateToSetting).toHaveBeenCalledWith("setting:library", expect.anything());
        expect(input).toHaveValue("");
    });

    it("clears a non-empty query on Escape without closing settings", () => {
        const { store } = renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        const input = screen.getByPlaceholderText(settings.search.placeholder);
        fireEvent.change(input, { target: { value: "library" } });
        fireEvent.keyDown(input, { key: "Escape", code: "Escape" });
        expect(input).toHaveValue("");
        expect(store.getState().ui.isOpen.settings).toBe(true);
    });

    it("closes settings on Escape when the query is empty", () => {
        const { store } = renderWithProviders(<SettingsSearch />, { preloadedState: openSettingsState });
        fireEvent.keyDown(screen.getByPlaceholderText(settings.search.placeholder), {
            key: "Escape",
            code: "Escape",
        });
        expect(store.getState().ui.isOpen.settings).toBe(false);
    });
});
