import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import ListNavigator from "./ListNavigator";

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
});
