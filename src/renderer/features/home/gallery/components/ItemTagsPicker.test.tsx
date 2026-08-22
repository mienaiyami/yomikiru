import path from "node:path";
import common from "@common/i18n/locales/en/common.json";
import home from "@common/i18n/locales/en/home.json";
import type { LibraryItemTag, LibraryTag } from "@common/types/db";
import { onInvoke } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ItemTagsPicker, ItemTagsRow } from "./ItemTagsPicker";

const { setColorSelectData } = vi.hoisted(() => ({
    setColorSelectData: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ setColorSelectData }),
}));

const itemLink = path.join("library", "series");

/** Catalog fixture for the tags picker. */
const catalog: LibraryTag[] = [
    { id: 1, name: "Ongoing", color: "#2563eb", createdAt: new Date(0) },
    { id: 2, name: "Done", color: "#16a34a", createdAt: new Date(0) },
];

describe("ItemTagsRow", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        setColorSelectData.mockClear();
    });

    it("shows assigned chips and replace-sets tags from the picker", async () => {
        const setItemTags = vi.fn(
            async (req: { itemLink: string; tagIds: number[] }): Promise<LibraryItemTag[]> =>
                req.tagIds.map((tagId) => ({ itemLink: req.itemLink, tagId })),
        );
        onInvoke("db:library:setItemTags", setItemTags);
        renderWithProviders(<ItemTagsRow itemLink={itemLink} />, {
            preloadedState: {
                tags: {
                    catalog,
                    assignments: [{ itemLink, tagId: 1 }],
                },
            },
        });
        expect(screen.getByText("Ongoing")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.edit }));
        expect(document.body.querySelector(".item-tags-picker")).not.toBeNull();
        expect(
            screen.getByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Done") }),
        ).toHaveAttribute("tabIndex", "0");
        fireEvent.click(
            screen.getByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Done") }),
        );
        await waitFor(() => {
            expect(setItemTags).toHaveBeenCalledWith({ itemLink, tagIds: [1, 2] });
        });
    });

    it("creates a catalog tag then assigns it", async () => {
        const created: LibraryTag = { id: 3, name: "New", color: "#dc2626", createdAt: new Date(0) };
        onInvoke("db:tags:create", async () => created);
        const setItemTags = vi.fn(async (): Promise<LibraryItemTag[]> => [{ itemLink, tagId: 3 }]);
        onInvoke("db:library:setItemTags", setItemTags);
        renderWithProviders(<ItemTagsRow itemLink={itemLink} />, {
            preloadedState: { tags: { catalog: [], assignments: [] } },
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.edit }));
        fireEvent.change(screen.getByPlaceholderText(home.gallery.tags.newNamePlaceholder), {
            target: { value: "New" },
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.create }));
        await waitFor(() => {
            expect(setItemTags).toHaveBeenCalledWith({ itemLink, tagIds: [3] });
        });
    });

    it("filters the catalog list by name", () => {
        renderWithProviders(<ItemTagsRow itemLink={itemLink} />, {
            preloadedState: { tags: { catalog, assignments: [] } },
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.edit }));
        fireEvent.change(screen.getByRole("textbox", { name: home.gallery.tags.listFilter }), {
            target: { value: "Done" },
        });
        expect(
            screen.queryByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Ongoing") }),
        ).not.toBeInTheDocument();
        expect(
            screen.getByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Done") }),
        ).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: common.list.clearSearch }));
        expect(
            screen.getByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Ongoing") }),
        ).toBeInTheDocument();
    });

    it("asks before deleting a catalog tag", async () => {
        const removeTag = vi.fn(async () => undefined);
        onInvoke("db:tags:delete", removeTag);
        onInvoke("dialog:warn", async () => ({ response: 1, checkboxChecked: false }));
        renderWithProviders(<ItemTagsRow itemLink={itemLink} />, {
            preloadedState: { tags: { catalog, assignments: [] } },
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.edit }));
        fireEvent.click(screen.getAllByRole("button", { name: home.gallery.tags.delete })[0]);
        await waitFor(() => {
            expect(removeTag).toHaveBeenCalledWith({ id: 2 });
        });
    });

    it("does not delete when the confirm is cancelled", async () => {
        const removeTag = vi.fn(async () => undefined);
        onInvoke("db:tags:delete", removeTag);
        onInvoke("dialog:warn", async () => ({ response: 0, checkboxChecked: false }));
        renderWithProviders(<ItemTagsRow itemLink={itemLink} />, {
            preloadedState: { tags: { catalog, assignments: [] } },
        });
        fireEvent.click(screen.getByRole("button", { name: home.gallery.tags.edit }));
        fireEvent.click(screen.getAllByRole("button", { name: home.gallery.tags.delete })[0]);
        await waitFor(() => {
            expect(
                screen.getByRole("checkbox", {
                    name: home.gallery.tags.assignAria.replace("{{name}}", "Ongoing"),
                }),
            ).toBeInTheDocument();
        });
        expect(removeTag).not.toHaveBeenCalled();
    });
});

describe("ItemTagsPicker selection mode", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        setColorSelectData.mockClear();
    });

    it("filters the catalog and reports checkbox changes without a library item", () => {
        const onSelectedIdsChange = vi.fn();
        renderWithProviders(
            <ItemTagsPicker
                selectedIds={[1]}
                onSelectedIdsChange={onSelectedIdsChange}
                onClose={vi.fn()}
            />,
            { preloadedState: { tags: { catalog, assignments: [] } } },
        );
        expect(screen.getByRole("textbox", { name: home.gallery.tags.listFilter })).toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("checkbox", { name: home.gallery.tags.assignAria.replace("{{name}}", "Done") }),
        );
        expect(onSelectedIdsChange).toHaveBeenCalledWith([1, 2]);
        expect(screen.queryByRole("button", { name: home.gallery.tags.edit })).toBeNull();
    });
});
