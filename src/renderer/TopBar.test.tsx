import { makeBookItem, SAMPLE_BOOK_LINK } from "@test/fixtures/libraryItem";
import { act, fireEvent } from "@testing-library/react";
import { USER_PRESET_BOOK_ID } from "@utils/readerPresets";
import { defaultBookReaderSettings } from "@utils/readerSettingsSchema";
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

describe("TopBar book progress", () => {
    it("widens continuous book progress for decimal precision", () => {
        const book = makeBookItem();
        const { getByRole } = renderWithProviders(<TopBar />, {
            preloadedState: {
                library: { items: { [SAMPLE_BOOK_LINK]: book }, metadata: {}, loading: false, error: null },
                reader: {
                    type: "book",
                    link: SAMPLE_BOOK_LINK,
                    content: book as typeof book & { type: "book" },
                    active: true,
                    loading: null,
                    presetSession: {
                        itemLink: SAMPLE_BOOK_LINK,
                        presetId: USER_PRESET_BOOK_ID,
                        settings: { ...defaultBookReaderSettings, continuousChapters: true },
                    },
                    epubChapterId: "chap-1",
                    epubElementQueryString: "",
                },
            },
        });

        expect(getByRole("spinbutton").classList.contains("continuousChapterProgress")).toBe(true);
    });
});

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
