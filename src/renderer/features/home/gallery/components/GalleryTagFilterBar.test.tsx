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

const emptyFilter = { includeIds: [] as number[], excludeIds: [] as number[] };

describe("GalleryTagFilterBar", () => {
    afterEach(() => {
        cleanup();
    });

    it("cycles a tag off to include when the chip label is clicked", () => {
        const onFilterChange = vi.fn();
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} tagFilter={emptyFilter} onFilterChange={onFilterChange} />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const dialog = screen.getByRole("dialog", { name: home.gallery.tags.filterAria });
        expect(
            within(dialog).getByRole("checkbox", {
                name: home.gallery.tags.filterOptionOffAria.replace("{{name}}", "Done"),
            }),
        ).toBeInTheDocument();
        fireEvent.click(within(dialog).getByText("Done"));
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: [2], excludeIds: [] });
    });

    it("cycles include to exclude on a second click", () => {
        const onFilterChange = vi.fn();
        renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1], excludeIds: [] }}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const dialog = screen.getByRole("dialog", { name: home.gallery.tags.filterAria });
        fireEvent.click(
            within(dialog).getByRole("checkbox", {
                name: home.gallery.tags.filterOptionIncludedAria.replace("{{name}}", "Ongoing"),
            }),
        );
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: [], excludeIds: [1] });
        expect(dialog).toBeInTheDocument();
    });

    it("cycles exclude back to off", () => {
        const onFilterChange = vi.fn();
        renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [], excludeIds: [1] }}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        fireEvent.click(
            within(screen.getByRole("dialog")).getByRole("checkbox", {
                name: home.gallery.tags.filterOptionExcludedAria.replace("{{name}}", "Ongoing"),
            }),
        );
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: [], excludeIds: [] });
    });

    it("shows no filter on the activator when nothing is selected", () => {
        renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} tagFilter={emptyFilter} onFilterChange={vi.fn()} />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterNoConstraint,
        );
    });

    it("shows the tag name when only one is included or excluded, otherwise +n -m", () => {
        const { rerender } = renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1], excludeIds: [] }}
                onFilterChange={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent("Ongoing");

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [], excludeIds: [1] }}
                onFilterChange={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent("Ongoing");

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1, 2], excludeIds: [] }}
                onFilterChange={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterPlusCount.replace("{{count}}", "2"),
        );

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [], excludeIds: [1, 2] }}
                onFilterChange={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterMinusCount.replace("{{count}}", "2"),
        );

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1, 2], excludeIds: [3] }}
                onFilterChange={vi.fn()}
            />,
        );
        expect(screen.getByRole("button", { name: home.gallery.tags.filterAria })).toHaveTextContent(
            home.gallery.tags.filterPlusMinusCount.replace("{{plus}}", "2").replace("{{minus}}", "1"),
        );
    });

    it("snaps mixed master state to include-all", () => {
        const onFilterChange = vi.fn();
        const sortedIds = [...catalog].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => tag.id);
        renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1], excludeIds: [2] }}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        fireEvent.click(screen.getByText(home.gallery.tags.filterSelectAll));
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: sortedIds, excludeIds: [] });
    });

    it("cycles master from all-include to exclude-all", () => {
        const onFilterChange = vi.fn();
        const sortedIds = [...catalog].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => tag.id);
        renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: sortedIds, excludeIds: [] }}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        fireEvent.click(screen.getByText(home.gallery.tags.filterExcludeAll));
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: [], excludeIds: sortedIds });
    });

    it("clears the filter from exclude-all via the master row", () => {
        const onFilterChange = vi.fn();
        const sortedIds = [...catalog].sort((a, b) => a.name.localeCompare(b.name)).map((tag) => tag.id);
        renderWithProviders(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [], excludeIds: sortedIds }}
                onFilterChange={onFilterChange}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        fireEvent.click(screen.getByText(home.gallery.tags.filterUnselectAll));
        expect(onFilterChange).toHaveBeenCalledWith({ includeIds: [], excludeIds: [] });
    });

    it("shows colour dots and triangles in the same mark container, capped at eight", () => {
        const { rerender } = renderWithProviders(
            <GalleryTagFilterBar catalog={catalog} tagFilter={emptyFilter} onFilterChange={vi.fn()} />,
        );
        expect(document.querySelectorAll(".galleryTagFilterDot")).toHaveLength(0);

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1], excludeIds: [] }}
                onFilterChange={vi.fn()}
            />,
        );
        const oneDot = document.querySelector(".galleryTagFilterDot") as HTMLElement;
        expect(oneDot).toHaveStyle({ backgroundColor: "rgb(37, 99, 235)" });
        expect(oneDot.className).not.toContain("galleryTagFilterMarkTriangle");

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [], excludeIds: [2] }}
                onFilterChange={vi.fn()}
            />,
        );
        const triangle = document.querySelector(".galleryTagFilterMarkTriangle") as HTMLElement;
        expect(triangle).toBeTruthy();
        expect(triangle).toHaveStyle({ backgroundColor: "rgb(22, 163, 74)" });

        rerender(
            <GalleryTagFilterBar
                catalog={catalog}
                tagFilter={{ includeIds: [1, 2, 3, 4], excludeIds: [5, 6, 7, 8, 9] }}
                onFilterChange={vi.fn()}
            />,
        );
        const marks = document.querySelectorAll(".galleryTagFilterDots .galleryTagFilterDot");
        expect(marks).toHaveLength(8);
        expect(document.querySelectorAll(".galleryTagFilterMarkTriangle")).toHaveLength(4);

        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.filterAria }));
        const ongoing = within(screen.getByRole("dialog")).getByText("Ongoing");
        expect(ongoing.className).toContain("inputMultiSelectTagChip");
        expect(ongoing).toHaveStyle({ background: "rgb(37, 99, 235)" });
    });
});
