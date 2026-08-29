import path from "node:path";
import { setReaderState } from "@store/reader";
import { makeMangaItem, SAMPLE_MANGA_LINK } from "@test/fixtures/libraryItem";
import { stubFs } from "@test/mocks/preload";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { CHAPTER_NAV_NONE } from "@utils/mangaChapters";
import { defaultSettings } from "@utils/settingsSchema";
import { createRef, useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ReaderSideList from "./ReaderSideList";

const { openInReader, setContextMenuData, closeReader } = vi.hoisted(() => ({
    openInReader: vi.fn(),
    setContextMenuData: vi.fn(),
    closeReader: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({
        contextMenuData: null,
        openInReader,
        setContextMenuData,
        closeReader,
    }),
}));

const SERIES = SAMPLE_MANGA_LINK;
const CH01 = path.join(SERIES, "ch01");
const CH02 = path.join(SERIES, "ch02");
const CH03 = path.join(SERIES, "ch03");
const CHAPTER_NAMES = ["ch01", "ch02", "ch03"] as const;

/**
 * Points `window.fs` at a series folder whose children are the given chapter dirs.
 */
const stubSeriesChapters = (names: readonly string[]): void => {
    const dirs = new Set<string>([SERIES, ...names.map((name) => path.join(SERIES, name))]);
    const files = names.map((name) => path.join(SERIES, name, "01.jpg"));
    const fileSet = new Set(files);
    stubFs({
        existsSync: (p) => dirs.has(p) || fileSet.has(p),
        isDir: (p) => dirs.has(p),
        isFile: (p) => fileSet.has(p),
        readdir: async (p) => {
            if (p === SERIES) return [...names];
            const chapter = names.find((name) => path.join(SERIES, name) === p);
            return chapter ? ["01.jpg"] : [];
        },
        access: async () => undefined,
        stat: async (p) =>
            ({
                mtimeMs: 1,
                isDir: dirs.has(p),
                isFile: fileSet.has(p),
            }) as Awaited<ReturnType<Window["fs"]["stat"]>>,
    });
};

/**
 * Renders {@link ReaderSideList} with manga reader state and a prev/next readout
 * so tests can assert navigation without clicking through the reader load path.
 */
const renderSideList = (options?: {
    autoRefresh?: boolean;
    chapterName?: string;
    chapterNames?: readonly string[];
}) => {
    const chapterNames = options?.chapterNames ?? CHAPTER_NAMES;
    const chapterName = options?.chapterName ?? "ch01";
    stubSeriesChapters(chapterNames);
    const item = makeMangaItem({ link: SERIES, title: "Side List Manga" }, { chapterName, itemLink: SERIES });
    const chapterLink = path.join(SERIES, chapterName);
    const openNextChapterRef = createRef<HTMLButtonElement>();
    const openPrevChapterRef = createRef<HTMLButtonElement>();
    const openRandomChapterRef = createRef<HTMLButtonElement>();
    const sideListSearchRef = createRef<HTMLInputElement>();
    const addToBookmarkRef = createRef<HTMLButtonElement>();

    const Harness = () => {
        const [prevNextChapter, setPrevNextChapter] = useState({ prev: "", next: "" });
        return (
            <>
                <span data-testid="nav-prev">{prevNextChapter.prev}</span>
                <span data-testid="nav-next">{prevNextChapter.next}</span>
                <ReaderSideList
                    openNextChapterRef={openNextChapterRef}
                    openPrevChapterRef={openPrevChapterRef}
                    openRandomChapterRef={openRandomChapterRef}
                    sideListSearchRef={sideListSearchRef}
                    addToBookmarkRef={addToBookmarkRef}
                    setShortcutText={vi.fn()}
                    isSideListPinned={true}
                    setSideListPinned={vi.fn()}
                    setSideListWidth={vi.fn()}
                    makeScrollPos={vi.fn()}
                    setPrevNextChapter={setPrevNextChapter}
                />
            </>
        );
    };

    const utils = renderWithProviders(<Harness />, {
        preloadedState: {
            appSettings: { ...defaultSettings, autoRefreshSideList: options?.autoRefresh ?? false },
            reader: {
                active: true,
                loading: null,
                type: "manga",
                link: chapterLink,
                content: item,
                mangaPageNumber: 1,
            },
            library: { items: { [SERIES]: item }, metadata: {}, loading: false, error: null },
        },
    });

    return {
        ...utils,
        item,
        openNextChapterRef,
        openRandomChapterRef,
        sideListSearchRef,
    };
};

/**
 * Types into the sidelist search field and waits until only matching chapter rows remain.
 */
const searchChapters = async (query: string, visibleNames: string[]) => {
    const input = document.querySelector("input.search-input") as HTMLInputElement;
    await act(async () => {
        fireEvent.change(input, { target: { value: query } });
    });
    await waitFor(() => {
        for (const name of visibleNames) {
            expect(screen.getByTitle(name)).toBeInTheDocument();
        }
    });
    return input;
};

describe("ReaderSideList chapter search pin", () => {
    beforeEach(() => {
        openInReader.mockReset();
        setContextMenuData.mockReset();
        closeReader.mockReset();
        /* jsdom has no layout, so current-chapter scrollIntoView would throw */
        HTMLElement.prototype.scrollIntoView = vi.fn();
    });

    it("lists sibling chapters once the folder scan finishes", async () => {
        renderSideList();
        await waitFor(() => {
            expect(screen.getByTitle("ch01")).toBeInTheDocument();
            expect(screen.getByTitle("ch02")).toBeInTheDocument();
            expect(screen.getByTitle("ch03")).toBeInTheDocument();
        });
        expect(screen.getByTestId("nav-next")).toHaveTextContent(CH02);
        expect(screen.getByTestId("nav-prev")).toHaveTextContent(CHAPTER_NAV_NONE);
    });

    /**
     * Prev/next used to skip updates while reader content is null, so a second
     * next click reused the same link and the reader load effect never ran.
     */
    it("recalculates prev/next from reader.link while content is cleared", async () => {
        const { store } = renderSideList();
        await waitFor(() => expect(screen.getByTestId("nav-next")).toHaveTextContent(CH02));
        await act(async () => {
            store.dispatch(
                setReaderState({
                    type: "manga",
                    link: CH02,
                    content: null,
                    mangaPageNumber: 1,
                }),
            );
        });
        await waitFor(() => {
            expect(screen.getByTestId("nav-prev")).toHaveTextContent(CH01);
            expect(screen.getByTestId("nav-next")).toHaveTextContent(CH03);
        });
    });

    it("opens the following chapter on a second next click after content is cleared", async () => {
        const { store, openNextChapterRef } = renderSideList();
        openInReader.mockImplementation((link: string) => {
            store.dispatch(
                setReaderState({
                    type: "manga",
                    link,
                    content: null,
                    mangaPageNumber: 1,
                }),
            );
        });
        await waitFor(() => expect(screen.getByTestId("nav-next")).toHaveTextContent(CH02));
        await act(async () => {
            openNextChapterRef.current?.click();
        });
        expect(openInReader).toHaveBeenCalledWith(CH02);
        await waitFor(() => expect(screen.getByTestId("nav-next")).toHaveTextContent(CH03));
        await act(async () => {
            openNextChapterRef.current?.click();
        });
        expect(openInReader).toHaveBeenCalledWith(CH03);
    });

    /**
     * Auto-refresh may not have run yet. Next must not set reader.link to the
     * old folder name; it should rescan and open the renamed sibling.
     */
    it("opens the renamed next chapter when the planned sibling is missing on disk", async () => {
        const { store, openNextChapterRef } = renderSideList();
        await waitFor(() => expect(screen.getByTestId("nav-next")).toHaveTextContent(CH02));
        const renamed = path.join(SERIES, "ch02aaaa");
        stubSeriesChapters(["ch01", "ch02aaaa", "ch03"]);
        await act(async () => {
            openNextChapterRef.current?.click();
        });
        await waitFor(() => {
            expect(openInReader).toHaveBeenCalledWith(renamed);
        });
        expect(openInReader).not.toHaveBeenCalledWith(CH02);
        expect(store.getState().reader.link).toBe(CH01);
    });

    it("opens the name-neighbor when the current chapter path is missing", async () => {
        const { store, openNextChapterRef } = renderSideList({ chapterName: "ch02" });
        await waitFor(() => expect(screen.getByTitle("ch02")).toBeInTheDocument());
        stubSeriesChapters(["ch01", "ch02aaaa", "ch03"]);
        await act(async () => {
            store.dispatch(
                setReaderState({
                    type: "manga",
                    link: CH02,
                    content: null,
                    mangaPageNumber: 1,
                }),
            );
        });
        await act(async () => {
            openNextChapterRef.current?.click();
        });
        await waitFor(() => {
            expect(openInReader).toHaveBeenCalledWith(path.join(SERIES, "ch02aaaa"));
        });
    });

    /**
     * Unpinned search is display-only. Prev/next must still follow the full
     * chapter list; limiting navigation to the query is the pin's job.
     */
    it("keeps prev/next on the full list while search is unpinned", async () => {
        renderSideList();
        await waitFor(() => expect(screen.getByTitle("ch01")).toBeInTheDocument());
        await searchChapters("ch01", ["ch01"]);
        expect(screen.queryByTitle("ch02")).toBeNull();
        expect(screen.getByTestId("nav-next")).toHaveTextContent(CH02);
        expect(screen.getByTestId("nav-prev")).toHaveTextContent(CHAPTER_NAV_NONE);
    });

    it("limits prev/next to the search subset only after the filter is pinned", async () => {
        renderSideList();
        await waitFor(() => expect(screen.getByTitle("ch01")).toBeInTheDocument());
        await searchChapters("ch01", ["ch01"]);
        await act(async () => {
            fireEvent.click(document.querySelector(".pin-filter-toggle") as HTMLButtonElement);
        });
        await waitFor(() => {
            expect(screen.getByTestId("nav-next")).toHaveTextContent(CHAPTER_NAV_NONE);
            expect(screen.getByTestId("nav-prev")).toHaveTextContent(CHAPTER_NAV_NONE);
        });
    });

    it("picks a random chapter from the full list while search is unpinned", async () => {
        const { openRandomChapterRef } = renderSideList();
        await waitFor(() => expect(screen.getByTitle("ch01")).toBeInTheDocument());
        await searchChapters("ch01", ["ch01"]);
        const seen = new Set<string>();
        for (let i = 0; i < 20; i++) {
            openInReader.mockClear();
            await act(async () => {
                openRandomChapterRef.current?.click();
            });
            expect(openInReader).toHaveBeenCalled();
            seen.add(openInReader.mock.calls[0][0] as string);
        }
        expect(seen.size).toBeGreaterThan(1);
        expect(seen.has(CH02) || seen.has(CH03)).toBe(true);
    });

    it("clears unpinned search when the open chapter changes", async () => {
        const { store, item } = renderSideList();
        await waitFor(() => expect(screen.getByTitle("ch01")).toBeInTheDocument());
        const input = await searchChapters("ch01", ["ch01"]);
        expect(input.value).toBe("ch01");
        await act(async () => {
            store.dispatch(
                setReaderState({
                    type: "manga",
                    link: CH02,
                    content: {
                        ...item,
                        progress: item.progress ? { ...item.progress, chapterName: "ch02" } : item.progress,
                    },
                    mangaPageNumber: 1,
                }),
            );
        });
        await waitFor(() => {
            expect(input.value).toBe("");
            expect(screen.getByTitle("ch02")).toBeInTheDocument();
            expect(screen.getByTitle("ch03")).toBeInTheDocument();
        });
        expect(screen.getByTestId("nav-next")).toHaveTextContent(CH03);
        expect(screen.getByTestId("nav-prev")).toHaveTextContent(CH01);
    });

    it("keeps pinned search when the open chapter changes", async () => {
        const { store, item } = renderSideList();
        await waitFor(() => expect(screen.getByTitle("ch01")).toBeInTheDocument());
        const input = await searchChapters("ch01", ["ch01"]);
        await act(async () => {
            fireEvent.click(document.querySelector(".pin-filter-toggle") as HTMLButtonElement);
        });
        await act(async () => {
            store.dispatch(
                setReaderState({
                    type: "manga",
                    link: CH02,
                    content: {
                        ...item,
                        progress: item.progress ? { ...item.progress, chapterName: "ch02" } : item.progress,
                    },
                    mangaPageNumber: 1,
                }),
            );
        });
        expect(input.value).toBe("ch01");
        expect(screen.queryByTitle("ch02")).toBeNull();
        expect(screen.getByTitle("ch01")).toBeInTheDocument();
    });

    it("rebuilds prev/next from disk after a watched chapter delete", async () => {
        let watchCb: (() => void) | undefined;
        window.chokidar = {
            watch: vi.fn(({ callback }) => {
                watchCb = callback;
                return () => undefined;
            }),
        } as Window["chokidar"];

        renderSideList({ autoRefresh: true, chapterName: "ch02" });
        await waitFor(() => expect(screen.getByTitle("ch03")).toBeInTheDocument());
        expect(screen.getByTestId("nav-next")).toHaveTextContent(CH03);

        stubSeriesChapters(["ch01", "ch02"]);
        expect(watchCb).toBeDefined();
        await act(async () => {
            watchCb?.();
        });
        await waitFor(
            () => {
                expect(screen.queryByTitle("ch03")).toBeNull();
                expect(screen.getByTestId("nav-next")).toHaveTextContent(CHAPTER_NAV_NONE);
                expect(screen.getByTestId("nav-prev")).toHaveTextContent(CH01);
            },
            { timeout: 2500 },
        );
    });
});
