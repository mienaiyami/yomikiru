import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { setLibraryScanStatus } from "./store/ui";
import TopBar from "./TopBar";

const { navigateToSettingMock } = vi.hoisted(() => ({
    navigateToSettingMock: vi.fn(),
}));

/**
 * TopBar reads App context for page inputs and closeReader; this file only
 * exercises the library-scan status control.
 */
vi.mock("./App", () => ({
    useAppContext: () => ({
        pageNumberInputRef: { current: null },
        bookProgressRef: { current: null },
        closeReader: vi.fn(),
    }),
}));

/* alias and relative specifiers must share the mock; TopBar imports the alias */
vi.mock("@features/settings/utils/navigateToSetting", () => ({
    navigateToSetting: navigateToSettingMock,
}));
vi.mock("./features/settings/utils/navigateToSetting", () => ({
    navigateToSetting: navigateToSettingMock,
}));

const walkingStatus = {
    phase: "walking" as const,
    rootIndex: 1,
    rootCount: 2,
    rootPath: "lib",
    currentPath: "lib",
    added: 1,
    skipped: 0,
    failed: 0,
    addIndex: 0,
    addTotal: 0,
};

describe("TopBar library scan status", () => {
    it("hides the scan control when idle", () => {
        const { queryByRole } = renderWithProviders(<TopBar />);
        expect(queryByRole("button", { name: "Scanning library" })).toBeNull();
    });

    it("shows live status and opens Library scan settings from the popover", () => {
        const { store, getByRole, queryByText } = renderWithProviders(<TopBar />);
        act(() => {
            store.dispatch(setLibraryScanStatus(walkingStatus));
        });
        fireEvent.click(getByRole("button", { name: "Scanning library" }));
        expect(getByRole("dialog", { name: "Scanning library" })).toBeTruthy();
        expect(queryByText("Added")).toBeNull();
        expect(getByRole("button", { name: "Open Library settings" })).toBeTruthy();
        fireEvent.click(getByRole("button", { name: "Open Library settings" }));
        expect(navigateToSettingMock).toHaveBeenCalledWith("setting:library-scan-now", store.dispatch);
        expect(getByRole("button", { name: "Cancel scan" })).toBeTruthy();
    });
});
