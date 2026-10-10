import type { EpubNcxTree, EpubToc } from "@common/epub";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { createRef, type RefObject, useRef } from "react";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import ContentList, { type ContentListHandle } from "./ContentList";

/** Roots before the nested branch so the leaf starts outside the side-list viewport. */
const LEADING_ROOTS = 24;

const CHAPTER_HREF = "chapters/nested.xhtml";
const LEAF_HREF = `${CHAPTER_HREF}#scene`;

/**
 * Four-level branch after {@link LEADING_ROOTS} file rows.
 * The leaf href is a fragment of the open spine file, which is the nested-TOC case.
 */
const makeDeepToc = (leafHref: string): { ncx: EpubNcxTree[]; toc: EpubToc } => {
    const toc: EpubToc = new Map();
    let nextNcxIndex = 0;
    const add = (navId: string, title: string, href: string, level: number, sub: EpubNcxTree[]): EpubNcxTree => {
        const ncxIndex = nextNcxIndex;
        nextNcxIndex += 1;
        toc.set(navId, { navId, title, href, level });
        return { navId, ncx_index1: ncxIndex, ncx_index2: ncxIndex, level, sub };
    };
    const roots: EpubNcxTree[] = [];
    for (let rootIndex = 0; rootIndex < LEADING_ROOTS; rootIndex++) {
        roots.push(add(`root-${rootIndex}`, `Root ${rootIndex}`, `root-${rootIndex}.xhtml`, 0, []));
    }
    const leaf = add("leaf", "Deep chapter", leafHref, 3, []);
    const inner = add("inner", "Inner", "inner.xhtml", 2, [leaf]);
    const mid = add("mid", "Mid", "mid.xhtml", 1, [inner]);
    roots.push(add("part", "Part", "part.xhtml", 0, [mid]));
    return { ncx: roots, toc };
};

const deepToc = makeDeepToc(LEAF_HREF);

const DeepList = ({ contentListRef }: { contentListRef: RefObject<ContentListHandle | null> }) => {
    const scrollRef = useRef<HTMLDivElement>(null);
    const sideRef = useRef<HTMLDivElement>(null);
    return (
        <div ref={sideRef}>
            <div className="location-cont" ref={scrollRef} data-testid="toc-scroll">
                <ContentList
                    ref={contentListRef}
                    currentChapterHref={CHAPTER_HREF}
                    epubNCX={deepToc.ncx}
                    epubTOC={deepToc.toc}
                    onEpubLinkClick={() => undefined}
                    sideListRef={sideRef}
                    scrollContainerRef={scrollRef}
                />
            </div>
        </div>
    );
};

describe("ContentList focus", () => {
    const restore: Array<() => void> = [];

    /*
     * jsdom reports 0 for unscrolled client and offset sizes, so TanStack mounts no rows.
     * These stubs give the side-list scroller a height and keep the scroll offset the virtualizer writes.
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
        const define = (proto: object, key: string, descriptor: PropertyDescriptor) => {
            const previous = Object.getOwnPropertyDescriptor(proto, key);
            Object.defineProperty(proto, key, descriptor);
            restore.push(() => {
                if (previous) Object.defineProperty(proto, key, previous);
                else delete (proto as Record<string, unknown>)[key];
            });
        };
        define(HTMLElement.prototype, "clientHeight", {
            configurable: true,
            get(this: HTMLElement) {
                return sizeFor(this);
            },
        });
        define(HTMLElement.prototype, "offsetHeight", {
            configurable: true,
            get(this: HTMLElement) {
                return sizeFor(this);
            },
        });
        define(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get() {
                return 280;
            },
        });
        define(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            get() {
                return 280;
            },
        });
        define(HTMLElement.prototype, "scrollHeight", {
            configurable: true,
            get(this: HTMLElement) {
                const child = this.firstElementChild as HTMLElement | null;
                const childHeight = child ? Number.parseFloat(child.style.height) : Number.NaN;
                return Math.max(this.clientHeight, Number.isFinite(childHeight) ? childHeight : 0);
            },
        });
        define(Element.prototype, "scrollTop", {
            configurable: true,
            get(this: Element) {
                return (this as HTMLElement & { __scrollTop?: number }).__scrollTop ?? 0;
            },
            set(this: Element, value: number) {
                (this as HTMLElement & { __scrollTop?: number }).__scrollTop = value;
                queueMicrotask(() => {
                    this.dispatchEvent(new Event("scroll"));
                });
            },
        });
        const scrollTo: typeof Element.prototype.scrollTo = function scrollToPolyfill(
            this: Element,
            ...args: [ScrollToOptions?] | [number, number]
        ) {
            const opts = typeof args[0] === "object" && args[0] !== null ? args[0] : { top: args[1] as number };
            if (typeof opts.top === "number") this.scrollTop = opts.top;
        };
        define(Element.prototype, "scrollTo", { configurable: true, value: scrollTo });
    });

    afterAll(() => {
        for (const undo of restore.reverse()) undo();
    });

    it("scrolls a nested fragment chapter into view and locate restores it after collapse", async () => {
        const contentListRef = createRef<ContentListHandle>();
        renderWithProviders(<DeepList contentListRef={contentListRef} />);

        await waitFor(() => {
            expect(screen.getByText("Deep chapter").closest("li")).toHaveClass("current");
        });
        expect(screen.queryByText("Root 0")).toBeNull();
        expect(screen.getByTestId("toc-scroll").scrollTop).toBeGreaterThan(0);
        expect(screen.getByText("Part").closest("li")).not.toHaveClass("current");

        const partRow = screen.getByText("Part").closest("li");
        expect(partRow).not.toBeNull();
        fireEvent.click(partRow as HTMLElement);
        await waitFor(() => {
            expect(screen.queryByText("Deep chapter")).toBeNull();
        });

        act(() => {
            contentListRef.current?.locateCurrent("center");
        });
        await waitFor(() => {
            expect(screen.getByText("Deep chapter").closest("li")).toHaveClass("current");
        });
    });
});
