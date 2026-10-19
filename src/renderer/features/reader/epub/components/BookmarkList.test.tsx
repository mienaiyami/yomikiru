import { makeBookItem, SAMPLE_BOOK_LINK } from "@test/fixtures/libraryItem";
import { renderWithProviders } from "@test/renderWithProviders";
import { waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import BookmarkList from "./BookmarkList";

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({
        contextMenuData: null,
        setContextMenuData: vi.fn(),
    }),
}));

const createdAt = new Date("2024-06-01T12:00:00.000Z");

const bookBookmark = (bookmarkId: number) => ({
    id: bookmarkId,
    itemLink: SAMPLE_BOOK_LINK,
    chapterName: "Chapter 1",
    chapterId: "chap-1",
    position: "body>p:nth-child(1)",
    note: null,
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
        renderWithProviders(<BookmarkList openChapterById={vi.fn()} />, {
            preloadedState: {
                reader: {
                    active: true,
                    loading: null,
                    type: "book",
                    link: SAMPLE_BOOK_LINK,
                    content: makeBookItem(),
                    epubChapterId: "chap-1",
                    epubElementQueryString: "",
                    presetSession: null,
                },
                bookmarks: {
                    manga: {},
                    book: {
                        [SAMPLE_BOOK_LINK]: [bookBookmark(1), bookBookmark(2)],
                    },
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
