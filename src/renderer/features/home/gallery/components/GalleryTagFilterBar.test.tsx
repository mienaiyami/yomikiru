import home from "@common/i18n/locales/en/home.json";
import type { LibraryTag } from "@common/types/db";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GalleryTagFilterBar from "./GalleryTagFilterBar";

/** Catalog fixture for the gallery tag filter. */
const catalog: LibraryTag[] = [
    { id: 1, name: "Ongoing", color: "#2563eb", createdAt: new Date(0) },
    { id: 2, name: "Done", color: "#16a34a", createdAt: new Date(0) },
    { id: 3, name: "A", color: "#111111", createdAt: new Date(0) },
    { id: 4, name: "B", color: "#222222", createdAt: new Date(0) },
    { id: 5, name: "C", color: "#333333", createdAt: new Date(0) },
    { id: 6, name: "D", color: "#444444", createdAt: new Date(0) },
    { id: 7, name: "E", color: "#555555", createdAt: new Date(0) },
    { id: 8, name: "F", color: "#666666", createdAt: new Date(0) },
    { id: 9, name: "G", color: "#777777", createdAt: new Date(0) },
];

describe("GalleryTagFilterBar", () => {
    afterEach(() => {
        cleanup();
    });

    it("reports selected tag ids when the tag chip label is clicked", () => {
        const onFilterChange = vi.fn();
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={[]} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const dialog = screen.getByRole("dialog", { name: home.gallery.tags.filterAria });
        fireEvent.click(within(dialog).getByText("Done"));
        expect(onFilterChange).toHaveBeenCalledWith([2]);
    });

    it("reports selected tag ids when options are toggled", () => {
        const onFilterChange = vi.fn();
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={[]} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const dialog = screen.getByRole("dialog", { name: home.gallery.tags.filterAria });
        fireEvent.click(
            within(dialog).getByRole("checkbox", {
                name: home.gallery.tags.filterOptionAria.replace("{{name}}", "Ongoing"),
            }),
        );
        expect(onFilterChange).toHaveBeenCalledWith([1]);
        expect(dialog).toBeInTheDocument();
    });

    it("shows no filter on the activator when nothing is selected", () => {
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={[]} onFilterChange={vi.fn()} />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterNoConstraint,
        );
    });

    it("shows a count label when more than one tag is selected", () => {
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={[1, 2]} onFilterChange={vi.fn()} />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterCount.replace("{{count}}", "2"),
        );
    });

    it("clears the filter via unselect all when every tag is selected", () => {
        const onFilterChange = vi.fn();
        const allIds = catalog.map((tag) => tag.id);
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={allIds} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterUnselectAll }));
        expect(onFilterChange).toHaveBeenCalledWith([]);
    });

    it("shows colour dots for selected tags on the activator, capped at eight", () => {
        const { rerender } = renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} selectedTagIds={[]} onFilterChange={vi.fn()} />,
        );
        expect(document.querySelectorAll(".galleryTagFilterDot")).toHaveLength(0);

        rerender(<GalleryTagFilterBar catalog={catalog} selectedTagIds={[1]} onFilterChange={vi.fn()} />);
        const oneDot = document.querySelector(".galleryTagFilterDot") as HTMLElement;
        expect(oneDot).toHaveStyle({ backgroundColor: "rgb(37, 99, 235)" });

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                selectedTagIds={[1, 2, 3, 4, 5, 6, 7, 8, 9]}
                onFilterChange={vi.fn()}
            />,
        );
        expect(document.querySelectorAll(".galleryTagFilterDot")).toHaveLength(8);

        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const ongoing = within(screen.getByRole("dialog")).getByText("Ongoing");
        expect(ongoing.className).toContain("inputMultiSelectTagChip");
        expect(ongoing).toHaveStyle({ background: "rgb(37, 99, 235)" });
    });
});
