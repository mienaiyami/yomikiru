import home from "@common/i18n/locales/en/home.json";
import { renderWithProviders } from "@test/renderWithProviders";
import { fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GalleryView from "./GalleryView";

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({
        openInReader: vi.fn(),
        setContextMenuData: vi.fn(),
    }),
}));
vi.mock("./components/BookDetailsPanel", () => ({ default: () => null }));
vi.mock("./components/MangaDetailsPanel", () => ({ default: () => null }));
vi.mock("@renderer/hooks/useResizeObserverRafWidth", () => ({
    useResizeObserverRafWidth: () => [{ current: null }, 0],
}));

describe("GalleryView", () => {
    it("keeps the search query when switching gallery sections", async () => {
        const { getByPlaceholderText, getByRole } = renderWithProviders(<GalleryView />);
        const searchInput = getByPlaceholderText(home.gallery.toolbar.searchPlaceholder) as HTMLInputElement;

        fireEvent.change(searchInput, { target: { value: "needle" } });
        fireEvent.click(getByRole("button", { name: home.gallery.tabs.library.title }));

        await waitFor(() => expect(searchInput.value).toBe("needle"));
    });
});
