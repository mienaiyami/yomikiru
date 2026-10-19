import { makeMangaItem, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { renderWithProviders } from "@test/renderWithProviders";
import { waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import BookmarkList from "./BookmarkList";

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({
        contextMenuData: null,
        openInReader: vi.fn(),
        setContextMenuData: vi.fn(),
    }),
}));

const createdAt = new Date("2024-06-01T12:00:00.000Z");

const mangaBookmark = (bookmarkId: number, page: number) => ({
    id: bookmarkId,
    itemLink: SAMPLE_MANGA_LINK,
    chapterName: "ch01",
    page,
    note: "",
    createdAt,
});

describe("BookmarkList row height", () => {
    const restore: Array<() => void> = [];

    /*
     * happy-dom reports 0 for unscrolled client and offset sizes, so TanStack mounts no rows.
     * Give `.location-cont` a height; an inline height still wins so virtual rows keep their own size.
     */
    beforeAll(() => {
        const sizeFor = (el: HTMLElement): number => {
            const inline = el.style?.height;
            if (inline) {
                const px = Number.parseFloat(inline);
                if (!Number.isNaN(px)) return px;
            }
            if (el.classList?.contains("location-cont")) return 400;
            return 0;
        };
        const define = (
            key: "clientHeight" | "offsetHeight" | "clientWidth" | "offsetWidth",
            get: () => number,
        ) => {
            const previous = Object.getOwnPropertyDescriptor(HTMLElement.prototype, key);
            Object.defineProperty(HTMLElement.prototype, key, { configurable: true, get });
            restore.push(() => {
                if (previous) Object.defineProperty(HTMLElement.prototype, key, previous);
                else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
            });
        };
        define("clientHeight", function (this: HTMLElement) {
            return sizeFor(this);
        });
        define("offsetHeight", function (this: HTMLElement) {
            return sizeFor(this);
        });
        define("clientWidth", () => 280);
        define("offsetWidth", () => 280);
    });

    afterAll(() => {
        for (const undo of restore.reverse()) undo();
    });

    it("gives each bookmark row the side-list bookmark height", async () => {
        const item = makeMangaItem();
        renderWithProviders(<BookmarkList />, {
            preloadedState: {
                reader: {
                    active: true,
                    loading: null,
                    type: "manga",
                    link: SAMPLE_MANGA_LINK,
                    content: item,
                    mangaPageNumber: 1,
                    presetSession: null,
                },
                bookmarks: {
                    manga: {
                        [SAMPLE_MANGA_LINK]: [mangaBookmark(1, 2), mangaBookmark(2, 4)],
                    },
                    book: {},
                    loading: false,
                    error: null,
                },
            },
        });

        await waitFor(() => {
            expect(document.querySelectorAll(".location-cont li").length).toBe(2);
        });
        const rows = [...document.querySelectorAll(".location-cont li")] as HTMLElement[];
        expect(rows[0]?.style.height).toBe("48px");
        expect(rows[1]?.style.height).toBe("48px");
        expect(rows[1]?.style.top).toBe("48px");
    });
});
