import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { healShortcutEntries } from "@utils/keybindings";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ListNavigator from "./ListNavigator";

const { scrollChildInContainer } = vi.hoisted(() => ({
    scrollChildInContainer: vi.fn(),
}));

vi.mock("@utils/utils", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@utils/utils")>();
    return { ...mod, scrollChildInContainer };
});

const ITEMS = ["alpha", "beta"];

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
