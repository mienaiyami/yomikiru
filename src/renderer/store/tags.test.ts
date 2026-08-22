import path from "node:path";
import type { LibraryItemTag, LibraryTag } from "@common/types/db";
import { configureStore } from "@reduxjs/toolkit";
import { onInvoke } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import tagsReducer, {
    createLibraryTag,
    deleteLibraryTag,
    setLibraryItemTags,
    unionLibraryItemTags,
    updateLibraryTag,
} from "./tags";

const itemLink = path.join("library", "tagged");

/** Catalog row for thunk merge tests. */
const tagRow = (patch: Partial<LibraryTag> = {}): LibraryTag => ({
    id: 1,
    name: "Ongoing",
    color: "#2563eb",
    createdAt: new Date(0),
    ...patch,
});

/** Isolated tags store. */
const makeStore = (catalog: LibraryTag[] = [], assignments: LibraryItemTag[] = []) =>
    configureStore({
        reducer: { tags: tagsReducer },
        preloadedState: { tags: { catalog, assignments } },
    });

describe("tags thunks", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("appends createLibraryTag to the catalog", async () => {
        const row = tagRow({ id: 2, name: "Done" });
        onInvoke("db:tags:create", async () => row);
        const store = makeStore([tagRow()]);
        await store.dispatch(createLibraryTag({ name: "Done", color: "#16a34a" }));
        expect(store.getState().tags.catalog).toHaveLength(2);
        expect(store.getState().tags.catalog[1]?.name).toBe("Done");
    });

    it("replaces a catalog row on updateLibraryTag", async () => {
        const updated = tagRow({ name: "Reading", color: "#dc2626" });
        onInvoke("db:tags:update", async () => updated);
        const store = makeStore([tagRow()]);
        await store.dispatch(updateLibraryTag({ id: 1, name: "Reading", color: "#dc2626" }));
        expect(store.getState().tags.catalog[0]?.name).toBe("Reading");
        expect(store.getState().tags.catalog[0]?.color).toBe("#dc2626");
    });

    it("drops the tag and its assignments on deleteLibraryTag", async () => {
        onInvoke("db:tags:delete", async () => true);
        const store = makeStore(
            [tagRow(), tagRow({ id: 2, name: "Keep" })],
            [
                { itemLink, tagId: 1 },
                { itemLink, tagId: 2 },
            ],
        );
        await store.dispatch(deleteLibraryTag({ id: 1 }));
        expect(store.getState().tags.catalog.map((row) => row.id)).toEqual([2]);
        expect(store.getState().tags.assignments).toEqual([{ itemLink, tagId: 2 }]);
    });

    it("replace-sets assignments for one item on setLibraryItemTags", async () => {
        const rows: LibraryItemTag[] = [{ itemLink, tagId: 2 }];
        onInvoke("db:library:setItemTags", async () => rows);
        const store = makeStore([tagRow(), tagRow({ id: 2 })], [{ itemLink, tagId: 1 }]);
        await store.dispatch(setLibraryItemTags({ itemLink, tagIds: [2] }));
        expect(store.getState().tags.assignments).toEqual(rows);
    });

    it("unions tag ids onto items without dropping other assignments", async () => {
        const other = path.join("library", "other");
        const rows: LibraryItemTag[] = [
            { itemLink, tagId: 1 },
            { itemLink, tagId: 2 },
        ];
        onInvoke("db:library:unionItemTags", async () => rows);
        const store = makeStore(
            [tagRow(), tagRow({ id: 2 })],
            [
                { itemLink, tagId: 1 },
                { itemLink: other, tagId: 1 },
            ],
        );
        await store.dispatch(unionLibraryItemTags({ itemLinks: [itemLink], tagIds: [2] }));
        expect(store.getState().tags.assignments).toEqual(
            expect.arrayContaining([...rows, { itemLink: other, tagId: 1 }]),
        );
        expect(store.getState().tags.assignments).toHaveLength(3);
    });
});
