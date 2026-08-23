import home from "@common/i18n/locales/en/home.json";
import { renderWithI18n } from "@test/renderWithProviders";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GalleryTabBar, { type GalleryTabId } from "./GalleryTabBar";

/**
 * Renders {@link GalleryTabBar} with a mock `onTabChange` for assertions.
 */
const renderBar = (activeTab: GalleryTabId = "continue-reading") => {
    const onTabChange = vi.fn();
    const utils = renderWithI18n(<GalleryTabBar activeTab={activeTab} onTabChange={onTabChange} />);
    return { ...utils, onTabChange };
};

describe("GalleryTabBar", () => {
    it("renders a button for each GalleryTabId", () => {
        const { getByRole } = renderBar();
        expect(getByRole("button", { name: home.gallery.tabs.continue.title })).toBeInTheDocument();
        expect(getByRole("button", { name: home.gallery.tabs.library.title })).toBeInTheDocument();
        expect(getByRole("button", { name: home.gallery.tabs.bookmarks.title })).toBeInTheDocument();
        expect(getByRole("button", { name: home.gallery.tabs.favourites.title })).toBeInTheDocument();
    });

    it("marks only the active tab as pressed", () => {
        const { getByRole } = renderBar("library");
        expect(getByRole("button", { name: home.gallery.tabs.library.title, pressed: true })).toBeInTheDocument();
        expect(
            getByRole("button", { name: home.gallery.tabs.continue.title, pressed: false }),
        ).toBeInTheDocument();
        expect(
            getByRole("button", { name: home.gallery.tabs.bookmarks.title, pressed: false }),
        ).toBeInTheDocument();
        expect(
            getByRole("button", { name: home.gallery.tabs.favourites.title, pressed: false }),
        ).toBeInTheDocument();
    });

    it("reports the picked tab id", () => {
        const { getByRole, onTabChange } = renderBar("continue-reading");
        fireEvent.click(getByRole("button", { name: home.gallery.tabs.library.title }));
        expect(onTabChange).toHaveBeenCalledWith("library");
        fireEvent.click(getByRole("button", { name: home.gallery.tabs.bookmarks.title }));
        expect(onTabChange).toHaveBeenCalledWith("bookmarks");
        fireEvent.click(getByRole("button", { name: home.gallery.tabs.favourites.title }));
        expect(onTabChange).toHaveBeenCalledWith("favourites");
    });
});
