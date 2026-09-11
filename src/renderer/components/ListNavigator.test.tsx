import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { healShortcutEntries } from "@utils/keybindings";
import { useRef, useState } from "react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import ListNavigator, {
    buildVirtualRowKey,
    measureVirtualElementSize,
    resolveListItemKey,
    resolveObservedScrollRect,
} from "./ListNavigator";

const { scrollChildInContainer } = vi.hoisted(() => ({
    scrollChildInContainer: vi.fn(),
}));

vi.mock("@utils/utils", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@utils/utils")>();
    return { ...mod, scrollChildInContainer };
});

const ITEMS = ["alpha", "beta"];

describe("virtual row keys", () => {
    it("resolveListItemKey prefers link then id then the value itself", () => {
        expect(resolveListItemKey("path/a", 0)).toBe("path/a");
        expect(resolveListItemKey({ link: "/manga/x" }, 3)).toBe("/manga/x");
        expect(resolveListItemKey({ id: 42 }, 3)).toBe(42);
        expect(resolveListItemKey({ name: "only" }, 7)).toBe(7);
    });

    it("buildVirtualRowKey changes when filter swaps which item sits at an index", () => {
        const before = [{ link: "a" }, { link: "b" }, { link: "c" }];
        const afterFilter = [{ link: "c" }];
        expect(buildVirtualRowKey(before, 0, 1)).toBe("a");
        expect(buildVirtualRowKey(afterFilter, 0, 1)).toBe("c");
        expect(buildVirtualRowKey(before, 0, 1)).not.toBe(buildVirtualRowKey(afterFilter, 0, 1));
    });

    it("buildVirtualRowKey joins cell keys for multi-column rows", () => {
        const items = [{ link: "a" }, { link: "b" }, { link: "c" }, { link: "d" }];
        expect(buildVirtualRowKey(items, 0, 2)).toBe("a\0b");
        expect(buildVirtualRowKey(items, 1, 2)).toBe("c\0d");
    });

    it("measureVirtualElementSize uses integer offsetHeight when no ResizeObserver entry", () => {
        const el = {
            offsetHeight: 41,
            offsetWidth: 100,
            getBoundingClientRect: () => ({ height: 40.6, width: 100 }),
        } as unknown as HTMLElement;
        Object.setPrototypeOf(el, HTMLElement.prototype);
        expect(measureVirtualElementSize(el, undefined, false)).toBe(41);
    });

    it("resolveObservedScrollRect keeps offset size when a ResizeObserver reading is 0", () => {
        const el = { offsetHeight: 400, offsetWidth: 300 } as HTMLElement;
        Object.setPrototypeOf(el, HTMLElement.prototype);
        expect(resolveObservedScrollRect(el, { width: 300, height: 0 })).toEqual({
            width: 300,
            height: 400,
        });
        expect(resolveObservedScrollRect(el, { width: 280, height: 360 })).toEqual({
            width: 280,
            height: 360,
        });
        expect(resolveObservedScrollRect(null, { width: 0, height: 0 })).toEqual({
            width: 0,
            height: 0,
        });
    });
});

describe("ListNavigator.Provider", () => {
    /**
     * Regression: gallery used to pass an inline onFilteredItemsChange that
     * called setState. Depending on that callback identity re-fired the effect
     * every render (max update depth).
     */
    it("does not loop when onFilteredItemsChange is unstable and setStates", async () => {
        const onChange = vi.fn();

        const Parent = () => {
            const [, bump] = useState(0);
            return (
                <ListNavigator.Provider
                    items={ITEMS}
                    renderItem={(item) => <span>{item}</span>}
                    onFilteredItemsChange={(items, filterActive) => {
                        onChange(items, filterActive);
                        bump((n) => n + 1);
                    }}
                >
                    <ListNavigator.List />
                </ListNavigator.Provider>
            );
        };

        renderWithProviders(<Parent />);

        await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
        expect(onChange).toHaveBeenCalledWith(ITEMS, false);
    });

    it("notifies onFilteredItemsChange when the search filter changes", async () => {
        const onChange = vi.fn();

        renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
                onFilteredItemsChange={onChange}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>,
        );

        await waitFor(() => expect(onChange).toHaveBeenCalledWith(ITEMS, false));
        onChange.mockClear();

        const input = document.querySelector("input.search-input") as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });

        await waitFor(() => {
            expect(onChange).toHaveBeenCalled();
            const [items, filterActive] = onChange.mock.calls.at(-1)!;
            expect(filterActive).toBe(true);
            expect(items).toEqual(["alpha"]);
        });
    });

    it("clears the filter when items change unless persistFilterOnItemsChange is set", async () => {
        const Harness = ({ items }: { items: string[] }) => (
            <ListNavigator.Provider
                items={items}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>
        );
        const { rerender, container } = renderWithProviders(<Harness items={ITEMS} />);
        const input = container.querySelector("input.search-input") as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });
        await waitFor(() => expect(input.value).toBe("alp"));
        rerender(<Harness items={[...ITEMS, "gamma"]} />);
        await waitFor(() => expect(input.value).toBe(""));
    });

    it("clears the filter when resetFilterKey changes unless persist is on", async () => {
        const Harness = ({ resetKey, persist }: { resetKey: string; persist?: boolean }) => (
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
                persistFilterOnItemsChange={persist}
                resetFilterKey={resetKey}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>
        );
        const { rerender, container } = renderWithProviders(<Harness resetKey="ch01" />);
        const input = container.querySelector("input.search-input") as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });
        await waitFor(() => expect(input.value).toBe("alp"));
        rerender(<Harness resetKey="ch02" />);
        await waitFor(() => expect(input.value).toBe(""));
    });

    it("keeps the filter across resetFilterKey changes when persistFilterOnItemsChange is set", async () => {
        const Harness = ({ resetKey }: { resetKey: string }) => (
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
                persistFilterOnItemsChange
                resetFilterKey={resetKey}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>
        );
        const { rerender, container } = renderWithProviders(<Harness resetKey="ch01" />);
        const input = container.querySelector("input.search-input") as HTMLInputElement;
        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });
        rerender(<Harness resetKey="ch02" />);
        expect(input.value).toBe("alp");
    });
});

describe("ListNavigator.SearchInput", () => {
    /**
     * The suite has no RTL auto-cleanup, so every query is scoped to this render's
     * own container instead of `document.body`.
     */
    const renderSearch = () => {
        const { container } = renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
                persistFilterOnItemsChange
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>,
        );
        return {
            input: container.querySelector("input.search-input") as HTMLInputElement,
            clearBtn: () => container.querySelector<HTMLButtonElement>(".search-input-clear"),
            itemTexts: () => Array.from(container.querySelectorAll("ol span")).map((el) => el.textContent),
        };
    };

    it("shows a keyboard-reachable clear button only while the input has a value", async () => {
        const { input, clearBtn } = renderSearch();

        expect(clearBtn()).toBeNull();

        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });

        await waitFor(() => expect(clearBtn()).not.toBeNull());
        expect(clearBtn()?.tabIndex).toBe(0);
    });

    it("clears the input and the filter when the clear button is pressed", async () => {
        const { input, clearBtn, itemTexts } = renderSearch();

        await act(async () => {
            fireEvent.change(input, { target: { value: "alp" } });
        });
        await waitFor(() => expect(itemTexts()).toEqual(["alpha"]));

        await act(async () => {
            fireEvent.click(clearBtn() as HTMLButtonElement);
        });

        expect(input.value).toBe("");
        await waitFor(() => {
            expect(itemTexts()).toEqual(ITEMS);
            expect(clearBtn()).toBeNull();
        });
    });

    it("seeds the field and shows the clear button when defaultValue is set", () => {
        const { container } = renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
                persistFilterOnItemsChange
            >
                <ListNavigator.SearchInput defaultValue="alp" />
                <ListNavigator.List />
            </ListNavigator.Provider>,
        );
        const input = container.querySelector("input.search-input") as HTMLInputElement;
        expect(input.value).toBe("alp");
        expect(container.querySelector(".search-input-clear")).not.toBeNull();
    });

    it("notifies onChange with an empty value when the clear button is pressed", async () => {
        const onChange = vi.fn();
        const { container } = renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                renderItem={(item) => <span>{item}</span>}
                persistFilterOnItemsChange
            >
                <ListNavigator.SearchInput defaultValue="alp" onChange={onChange} />
                <ListNavigator.List />
            </ListNavigator.Provider>,
        );
        const clearBtn = container.querySelector(".search-input-clear") as HTMLButtonElement;
        await act(async () => {
            fireEvent.click(clearBtn);
        });
        expect(onChange).toHaveBeenCalledTimes(1);
        const event = onChange.mock.calls[0][0] as { target: HTMLInputElement };
        expect(event.target.value).toBe("");
        expect((container.querySelector("input.search-input") as HTMLInputElement).value).toBe("");
    });

    it("does not focus the field on mount when autoFocus is false", () => {
        const { container } = renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                filterFn={(filter, item) => new RegExp(filter, "i").test(item)}
                renderItem={(item) => <span>{item}</span>}
            >
                <ListNavigator.SearchInput autoFocus={false} />
                <ListNavigator.List />
            </ListNavigator.Provider>,
        );
        const input = container.querySelector("input.search-input") as HTMLInputElement;
        expect(input).not.toBe(document.activeElement);
    });

    it("focuses the field after autoFocusDelayMs", async () => {
        vi.useFakeTimers();
        try {
            const { container } = renderWithProviders(
                <ListNavigator.Provider items={ITEMS} renderItem={(item) => <span>{item}</span>}>
                    <ListNavigator.SearchInput autoFocusDelayMs={100} />
                    <ListNavigator.List />
                </ListNavigator.Provider>,
            );
            const input = container.querySelector("input.search-input") as HTMLInputElement;
            expect(input).not.toBe(document.activeElement);
            await act(async () => {
                vi.advanceTimersByTime(100);
            });
            expect(input).toBe(document.activeElement);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe("ListNavigator keyboard on focused rows", () => {
    const defaultShortcuts = { shortcuts: healShortcutEntries([]) };

    it("fires contextMenu for a focused row that has no inner a", () => {
        const onContextMenu = vi.fn();
        renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                renderItem={(item, _i, selected) => <div data-focused={selected}>{item}</div>}
                onContextMenu={onContextMenu}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>,
            { preloadedState: defaultShortcuts },
        );

        const input = document.querySelector("input.search-input") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(input, { key: "/", code: "Slash", ctrlKey: true });
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        expect(onContextMenu.mock.calls[0][0]).toBeInstanceOf(HTMLElement);
        expect((onContextMenu.mock.calls[0][0] as HTMLElement).textContent).toBe("alpha");
    });

    it("fires contextMenu on the inner a when the focused row has one", () => {
        const onContextMenu = vi.fn();
        renderWithProviders(
            <ListNavigator.Provider
                items={ITEMS}
                renderItem={(item, _i, selected) => (
                    <li data-focused={selected}>
                        <a href="#">{item}</a>
                    </li>
                )}
                onContextMenu={onContextMenu}
            >
                <ListNavigator.SearchInput />
                <ListNavigator.List />
            </ListNavigator.Provider>,
            { preloadedState: defaultShortcuts },
        );

        const input = document.querySelector("input.search-input") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(input, { key: "/", code: "Slash", ctrlKey: true });
        expect(onContextMenu).toHaveBeenCalledTimes(1);
        expect((onContextMenu.mock.calls[0][0] as HTMLElement).tagName).toBe("A");
    });

    /**
     * Details lists scroll the overflow parent via {@link scrollChildInContainer}
     * so ancestor boxes (hero / meta) do not move. Classic lists omit the ref.
     */
    it("scrolls the focused row inside scrollContainerRef when list focus moves", () => {
        scrollChildInContainer.mockClear();
        const Harness = () => {
            const scrollRef = useRef<HTMLDivElement>(null);
            return (
                <ListNavigator.Provider
                    items={ITEMS}
                    renderItem={(item, _i, selected) => <div data-focused={selected}>{item}</div>}
                >
                    <ListNavigator.SearchInput />
                    <div ref={scrollRef}>
                        <ListNavigator.List scrollContainerRef={scrollRef} />
                    </div>
                </ListNavigator.Provider>
            );
        };
        renderWithProviders(<Harness />, { preloadedState: defaultShortcuts });
        const input = document.querySelector("input.search-input") as HTMLInputElement;
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        expect(scrollChildInContainer).toHaveBeenCalled();
        const first = scrollChildInContainer.mock.calls.at(-1);
        expect(first?.[2]).toBe("nearest");
        expect((first?.[1] as HTMLElement).textContent).toBe("alpha");
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        const second = scrollChildInContainer.mock.calls.at(-1);
        expect((second?.[1] as HTMLElement).textContent).toBe("beta");
    });
});

describe("ListNavigator.VirtualList hostRowElement=false", () => {
    const defaultShortcuts = { shortcuts: healShortcutEntries([]) };
    const MANY = Array.from({ length: 40 }, (_, i) => `row-${i}`);

    /**
     * happy-dom leaves clientHeight/Width at 0 for styled boxes; TanStack then
     * returns no virtual items. Mirror inline height/width for this suite only.
     * Also stub ResizeObserver: happy-dom reports borderBoxSize 0 and would
     * overwrite the initial getRect() from our offsetHeight mock.
     */
    beforeAll(() => {
        class NoopResizeObserver {
            observe(): void {
                /* skip: happy-dom RO would overwrite getRect with 0 */
            }
            unobserve(): void {
                /* no-op stub */
            }
            disconnect(): void {
                /* no-op stub */
            }
        }
        Object.defineProperty(window, "ResizeObserver", {
            configurable: true,
            writable: true,
            value: NoopResizeObserver,
        });
        Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
            configurable: true,
            /* happy-dom: style height often does not feed offsetHeight; TanStack needs a non-zero rect */
            get: () => 120,
        });
        Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
            configurable: true,
            value(this: HTMLElement) {
                const height = this.offsetHeight || 0;
                const width = this.offsetWidth || 300;
                return {
                    x: 0,
                    y: 0,
                    top: 0,
                    left: 0,
                    bottom: height,
                    right: width,
                    width,
                    height,
                    toJSON() {
                        return this;
                    },
                };
            },
        });
        Object.defineProperty(HTMLElement.prototype, "clientHeight", {
            configurable: true,
            get(this: HTMLElement) {
                return this.offsetHeight;
            },
        });
        Object.defineProperty(HTMLElement.prototype, "clientWidth", {
            configurable: true,
            get(this: HTMLElement) {
                const fromStyle = Number.parseFloat(this.style?.width || "");
                if (!Number.isNaN(fromStyle) && fromStyle > 0) return fromStyle;
                return 300;
            },
        });
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            get(this: HTMLElement) {
                return this.clientWidth;
            },
        });
        /* TanStack scrolls via element.scrollTo; defer scroll events off the layout path */
        Element.prototype.scrollTo = function scrollToPolyfill(
            this: Element,
            ...args: [ScrollToOptions?] | [number, number]
        ) {
            const opts = typeof args[0] === "object" && args[0] !== null ? args[0] : { top: args[1] as number };
            if (typeof opts.top === "number") {
                (this as HTMLElement & { __scrollTop?: number }).__scrollTop = opts.top;
            }
            if (typeof opts.left === "number") {
                (this as HTMLElement & { __scrollLeft?: number }).__scrollLeft = opts.left;
            }
            queueMicrotask(() => {
                this.dispatchEvent(new Event("scroll"));
            });
        };
        const originalScrollTop = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTop");
        Object.defineProperty(Element.prototype, "scrollTop", {
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
        (globalThis as { __restoreScrollTop?: () => void }).__restoreScrollTop = () => {
            if (originalScrollTop) Object.defineProperty(Element.prototype, "scrollTop", originalScrollTop);
        };
    });

    afterAll(() => {
        (globalThis as { __restoreScrollTop?: () => void }).__restoreScrollTop?.();
    });

    /**
     * Fixed-height scroller so only a few rows mount. Rows are real `<li>` from renderItem.
     */
    const VirtualHarness = ({
        ensureVisibleIndex,
        ensureVisibleAlign,
        ensureVisibleNonce,
        items = MANY,
    }: {
        ensureVisibleIndex?: number;
        ensureVisibleAlign?: "start" | "center" | "end" | "auto";
        ensureVisibleNonce?: number;
        items?: string[];
    }) => {
        const scrollRef = useRef<HTMLDivElement>(null);
        return (
            <ListNavigator.Provider
                items={items}
                renderItem={(item, _i, selected) => (
                    <li data-focused={selected} data-testid={`item-${item}`} style={{ height: 40 }}>
                        <a href="#">{item}</a>
                    </li>
                )}
            >
                <ListNavigator.SearchInput />
                <div ref={scrollRef} style={{ height: 120, overflow: "auto" }} data-testid="scroller">
                    <ListNavigator.VirtualList
                        scrollContainerRef={scrollRef}
                        estimatedItemSize={40}
                        hostRowElement={false}
                        rowGapPx={0}
                        overscan={2}
                        ensureVisibleIndex={ensureVisibleIndex}
                        ensureVisibleAlign={ensureVisibleAlign}
                        ensureVisibleNonce={ensureVisibleNonce}
                    />
                </div>
            </ListNavigator.Provider>
        );
    };

    it("does not mount far-off rows until scrolled", async () => {
        renderWithProviders(<VirtualHarness />, { preloadedState: defaultShortcuts });
        await waitFor(() => {
            expect(document.querySelector('[data-testid="item-row-0"]')).not.toBeNull();
        });
        expect(document.querySelector('[data-testid="item-row-39"]')).toBeNull();
    });

    it("mounts a far row after the scroller offset changes", async () => {
        renderWithProviders(<VirtualHarness />, { preloadedState: defaultShortcuts });
        await waitFor(() => {
            expect(document.querySelector('[data-testid="item-row-0"]')).not.toBeNull();
        });
        const scroller = document.querySelector('[data-testid="scroller"]') as HTMLElement;
        await act(async () => {
            scroller.scrollTop = 35 * 40;
            scroller.dispatchEvent(new Event("scroll"));
        });
        await waitFor(() => {
            expect(document.querySelector('[data-testid="item-row-35"]')).not.toBeNull();
        });
    });

    it("marks the list as virtual and positions host rows with data-index", async () => {
        const Harness = () => {
            const scrollRef = useRef<HTMLDivElement>(null);
            return (
                <ListNavigator.Provider
                    items={["short", "tall"]}
                    renderItem={(item, _i, selected) => (
                        <li
                            data-focused={selected}
                            data-testid={`item-${item}`}
                            style={{ height: item === "tall" ? 80 : 20 }}
                        >
                            <a href="#">{item}</a>
                        </li>
                    )}
                >
                    <div ref={scrollRef} style={{ height: 200, overflow: "auto" }} data-testid="scroller">
                        <ListNavigator.VirtualList
                            scrollContainerRef={scrollRef}
                            estimatedItemSize={40}
                            hostRowElement={false}
                            rowGapPx={0}
                            ensureVisibleIndex={1}
                            ensureVisibleAlign="start"
                        />
                    </div>
                </ListNavigator.Provider>
            );
        };
        renderWithProviders(<Harness />, { preloadedState: defaultShortcuts });
        await waitFor(() => {
            expect(document.querySelector("ol.is-virtual")).not.toBeNull();
            expect(document.querySelector('[data-testid="item-short"]')).not.toBeNull();
            expect(document.querySelector('[data-testid="item-tall"]')).not.toBeNull();
        });
        const shortRow = document.querySelector('[data-testid="item-short"]') as HTMLElement;
        const tallRow = document.querySelector('[data-testid="item-tall"]') as HTMLElement;
        expect(shortRow.style.position).toBe("absolute");
        expect(tallRow.style.position).toBe("absolute");
        expect(shortRow.style.top).toBe("0px");
        /* fixed-size path: every row uses estimatedItemSize (not DOM-measured content height) */
        expect(tallRow.style.top).toBe("40px");
        expect(shortRow.style.transform).toBe("");
        expect(shortRow.getAttribute("data-index")).toBe("0");
        expect(tallRow.getAttribute("data-index")).toBe("1");
        expect(shortRow.style.height).toBe("40px");
        expect(tallRow.style.height).toBe("40px");
    });

    it("applies estimatedItemSize as the host row height on the fixed-size path", async () => {
        const Harness = () => {
            const scrollRef = useRef<HTMLDivElement>(null);
            return (
                <ListNavigator.Provider
                    items={["a", "b"]}
                    renderItem={(item, _i, selected) => (
                        <li data-focused={selected} data-testid={`item-${item}`}>
                            <a href="#">{item}</a>
                        </li>
                    )}
                >
                    <div ref={scrollRef} style={{ height: 200, overflow: "auto" }} data-testid="scroller">
                        <ListNavigator.VirtualList
                            scrollContainerRef={scrollRef}
                            estimatedItemSize={40}
                            hostRowElement={false}
                            rowGapPx={0}
                        />
                    </div>
                </ListNavigator.Provider>
            );
        };
        renderWithProviders(<Harness />, { preloadedState: defaultShortcuts });
        await waitFor(() => {
            expect(document.querySelector('[data-testid="item-a"]')).not.toBeNull();
        });
        const row = document.querySelector('[data-testid="item-a"]') as HTMLElement;
        expect(row.style.height).toBe("40px");
    });

    it("measures variable host row heights when dynamicItemSize is enabled", async () => {
        const Harness = () => {
            const scrollRef = useRef<HTMLDivElement>(null);
            return (
                <ListNavigator.Provider
                    items={["short", "tall"]}
                    renderItem={(item, _i, selected) => (
                        <li
                            data-focused={selected}
                            data-testid={`item-${item}`}
                            style={{ height: item === "tall" ? 80 : 20 }}
                        >
                            <a href="#">{item}</a>
                        </li>
                    )}
                >
                    <div ref={scrollRef} style={{ height: 200, overflow: "auto" }} data-testid="scroller">
                        <ListNavigator.VirtualList
                            scrollContainerRef={scrollRef}
                            estimatedItemSize={40}
                            hostRowElement={false}
                            rowGapPx={0}
                            dynamicItemSize
                        />
                    </div>
                </ListNavigator.Provider>
            );
        };
        renderWithProviders(<Harness />, { preloadedState: defaultShortcuts });
        await waitFor(() => {
            expect(document.querySelector('[data-testid="item-short"]')).not.toBeNull();
            expect(document.querySelector('[data-testid="item-tall"]')).not.toBeNull();
        });
        const shortRow = document.querySelector('[data-testid="item-short"]') as HTMLElement;
        const tallRow = document.querySelector('[data-testid="item-tall"]') as HTMLElement;
        expect(shortRow.style.height).toBe("auto");
        expect(tallRow.style.height).toBe("auto");
    });
});
