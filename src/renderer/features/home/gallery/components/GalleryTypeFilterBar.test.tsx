import { renderWithI18n } from "@test/renderWithProviders";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GalleryTypeFilterBar, { type GalleryTypeFilterId } from "./GalleryTypeFilterBar";

/**
 * Renders {@link GalleryTypeFilterBar} with a mock `onFilterChange` for assertions.
 */
const renderBar = (activeFilter: GalleryTypeFilterId = "all") => {
    const onFilterChange = vi.fn();
    const utils = renderWithI18n(
        <GalleryTypeFilterBar activeFilter={activeFilter} onFilterChange={onFilterChange} />,
    );
    return { ...utils, onFilterChange };
};

describe("GalleryTypeFilterBar", () => {
    it("marks only the active filter as pressed", () => {
        const { container } = renderBar("book");
        const pressed = container.querySelectorAll('button[aria-pressed="true"]');
        expect(pressed).toHaveLength(1);
        expect(pressed[0].textContent).toContain("eBook");
    });

    it("reports the picked filter id", () => {
        const { container, onFilterChange } = renderBar("all");
        const buttons = container.querySelectorAll("button");
        fireEvent.click(buttons[1]);
        expect(onFilterChange).toHaveBeenCalledWith("manga");
        fireEvent.click(buttons[2]);
        expect(onFilterChange).toHaveBeenCalledWith("book");
    });

    it("spells out what each type covers in its tooltip", () => {
        const { container } = renderBar();
        const buttons = [...container.querySelectorAll("button")];
        const manga = buttons[1];
        const book = buttons[2];
        expect(manga?.getAttribute("data-tooltip")).toMatch(/manhwa/i);
        expect(manga?.getAttribute("data-tooltip")).toMatch(/webtoon/i);
        expect(book?.getAttribute("data-tooltip")).toMatch(/EPUB/);
        expect(book?.getAttribute("data-tooltip")).toMatch(/PDF is not included/i);
    });
});
