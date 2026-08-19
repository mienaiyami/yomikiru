import home from "@common/i18n/locales/en/home.json";
import type { LibraryTag } from "@common/types/db";
import { renderWithI18n } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GalleryTagFilterBar, { TAG_FILTER_STRIPE } from "./GalleryTagFilterBar";

const { setOptSelectData } = vi.hoisted(() => ({
    setOptSelectData: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ setOptSelectData }),
}));

/** Catalog fixture for the gallery tag filter. */
const catalog: LibraryTag[] = [
    { id: 1, name: "Ongoing", color: "#2563eb", createdAt: new Date(0) },
    { id: 2, name: "Done", color: "#16a34a", createdAt: new Date(0) },
];

/** Last non-null menu payload passed to {@link setOptSelectData}. */
const lastMenu = (): Menu.OptSelectData | null => {
    for (let i = setOptSelectData.mock.calls.length - 1; i >= 0; i--) {
        const arg = setOptSelectData.mock.calls[i]?.[0];
        if (arg && typeof arg === "object" && "items" in arg) return arg as Menu.OptSelectData;
    }
    return null;
};

describe("GalleryTagFilterBar", () => {
    afterEach(() => {
        cleanup();
        setOptSelectData.mockClear();
        vi.restoreAllMocks();
    });

    it("reports the selected tag id from the filter menu", () => {
        const onFilterChange = vi.fn();
        renderWithI18n(
            <GalleryTagFilterBar catalog={catalog} selectedTagId={null} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: new RegExp(home.gallery.tags.filterAll) }));
        lastMenu()
            ?.items.find((item) => item.label === "Ongoing")
            ?.action();
        expect(onFilterChange).toHaveBeenCalledWith(1);
    });

    it("clears the tag constraint when All is chosen", () => {
        const onFilterChange = vi.fn();
        renderWithI18n(
            <GalleryTagFilterBar catalog={catalog} selectedTagId={1} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: /Ongoing/ }));
        lastMenu()
            ?.items.find((item) => item.label === home.gallery.tags.filterAll)
            ?.action();
        expect(onFilterChange).toHaveBeenCalledWith(null);
    });

    it("seeds the stripe width on the bar and colour when a tag is selected", () => {
        const { rerender } = renderWithI18n(
            <GalleryTagFilterBar catalog={catalog} selectedTagId={null} onFilterChange={vi.fn()} />,
        );
        const bar = () => document.querySelector(".galleryTagFilterBar") as HTMLElement;
        expect(bar().style.getPropertyValue("--gallery-tag-filter-stripe")).toBe(TAG_FILTER_STRIPE);
        expect(bar().style.getPropertyValue("--gallery-tag-filter-color")).toBe("");
        rerender(<GalleryTagFilterBar catalog={catalog} selectedTagId={1} onFilterChange={vi.fn()} />);
        expect(bar().style.getPropertyValue("--gallery-tag-filter-stripe")).toBe(TAG_FILTER_STRIPE);
        expect(bar().style.getPropertyValue("--gallery-tag-filter-color")).toBe("#2563eb");
        fireEvent.click(screen.getByRole("button", { name: /Ongoing/ }));
        expect(lastMenu()?.items.find((item) => item.label === "Ongoing")?.style?.boxShadow).toBe(
            `inset ${TAG_FILTER_STRIPE} 0 0 #2563eb`,
        );
    });
});
