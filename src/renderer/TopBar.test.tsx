import { act, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../test/renderWithProviders";
import { setLibraryScanBusy } from "./store/ui";
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

describe("TopBar library scan status", () => {
    it("hides the scan control when idle", () => {
        const { queryByRole } = renderWithProviders(<TopBar />);
        expect(queryByRole("button", { name: "Scanning library" })).toBeNull();
    });

    it("shows the scan control and opens Library scan settings", () => {
        const { store, getByRole } = renderWithProviders(<TopBar />);
        act(() => {
            store.dispatch(setLibraryScanBusy(true));
        });
        const status = getByRole("button", { name: "Scanning library" });
        fireEvent.click(status);
        expect(navigateToSettingMock).toHaveBeenCalledWith("setting:library-scan-now", store.dispatch);
    });
});
