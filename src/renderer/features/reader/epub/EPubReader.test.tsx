import { makeBookItem, SAMPLE_BOOK_LINK } from "@test/fixtures/libraryItem";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent } from "@testing-library/react";
import { USER_PRESET_BOOK_ID } from "@utils/readerPresets";
import { defaultBookReaderSettings } from "@utils/readerSettingsSchema";
import { afterEach, describe, expect, it, vi } from "vitest";
import EPubReader from "./EPubReader";

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ bookProgressRef: { current: null }, setContextMenuData: vi.fn() }),
}));
vi.mock("./EPubReaderSettings", () => ({
    default: ({ makeScrollPos }: { makeScrollPos: () => void }) => (
        <button onClick={makeScrollPos}>Change layout</button>
    ),
}));
vi.mock("./EPubReaderSideList", () => ({ default: () => null }));
vi.mock("./StyleSheets", () => ({ default: () => null }));
vi.mock("./components/FootNodeModal", () => ({ default: () => null }));
vi.mock("@utils/epub", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@utils/epub")>()),
    // keep opening pending so this capture test only needs the visible chapter DOM
    readEpubFile: () =>
        new Promise(() => {
            /* intentionally unresolved fixture IO */
        }),
}));

afterEach(() => vi.restoreAllMocks());

describe("continuous reader position capture", () => {
    it("samples the viewport in bounded work even far into a long book and saves the visible chapter", () => {
        const book = makeBookItem();
        const { container, store } = renderWithProviders(<EPubReader />, {
            preloadedState: {
                library: { items: { [SAMPLE_BOOK_LINK]: book }, metadata: {}, loading: false, error: null },
                reader: {
                    type: "book",
                    link: SAMPLE_BOOK_LINK,
                    content: book as typeof book & { type: "book" },
                    active: true,
                    loading: null,
                    presetSession: {
                        itemLink: SAMPLE_BOOK_LINK,
                        presetId: USER_PRESET_BOOK_ID,
                        settings: { ...defaultBookReaderSettings, continuousChapters: true },
                    },
                    epubChapterId: "chap-1",
                    epubElementQueryString: "",
                },
            },
        });
        const reader = container.querySelector<HTMLElement>("#EPubReader")!;
        const main = container.querySelector<HTMLElement>("section.main")!;
        const chapter = document.createElement("div");
        chapter.id = "epub-chap-2";
        chapter.className = "htmlCont";
        const paragraph = document.createElement("p");
        paragraph.textContent = "The paragraph visible deep into the book";
        chapter.append(paragraph);
        main.append(chapter);
        reader.getBoundingClientRect = () => new DOMRect(0, 40, 1000, 700);
        main.getBoundingClientRect = () => new DOMRect(0, -100000, 1000, 200000);
        chapter.getBoundingClientRect = () => new DOMRect(200, -100, 600, 3000);
        paragraph.getBoundingClientRect = () => new DOMRect(200, 40, 600, 100);
        const hitTest = vi.fn((_x: number, y: number) => (y >= 40 && y < 740 ? paragraph : null));
        Object.defineProperty(document, "elementFromPoint", { configurable: true, value: hitTest });

        const started = performance.now();
        act(() => window.app.flushEpubScrollPos?.());
        const elapsedMs = performance.now() - started;

        expect(
            hitTest.mock.calls.length,
            `${hitTest.mock.calls.length} hit tests in ${elapsedMs.toFixed(1)}ms`,
        ).toBeLessThan(20);
        expect(store.getState().reader.content?.progress).toMatchObject({
            chapterId: "chap-2",
            position: expect.stringContaining("p"),
        });
    });

    it("does not enable layout capture or disable browser anchoring in normal mode", () => {
        const hitTest = vi.fn(() => null);
        Object.defineProperty(document, "elementFromPoint", { configurable: true, value: hitTest });
        const book = makeBookItem({ extra: { continuousScroll: true } });
        const { getByText, container } = renderWithProviders(<EPubReader />, {
            preloadedState: {
                library: { items: { [SAMPLE_BOOK_LINK]: book }, metadata: {}, loading: false, error: null },
                reader: {
                    type: "book",
                    link: SAMPLE_BOOK_LINK,
                    content: book as typeof book & { type: "book" },
                    active: true,
                    loading: null,
                    presetSession: null,
                    epubChapterId: "chap-1",
                    epubElementQueryString: "",
                },
            },
        });
        fireEvent.click(getByText("Change layout"));
        expect(hitTest).not.toHaveBeenCalled();
        expect(container.querySelector<HTMLElement>("#EPubReader")?.style.overflowAnchor).not.toBe("none");
    });
});
