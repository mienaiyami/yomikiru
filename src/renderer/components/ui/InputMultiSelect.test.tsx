import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InputMultiSelect, { type InputMultiSelectOption } from "./InputMultiSelect";

/** Option fixtures for {@link InputMultiSelect} tests. */
const options: InputMultiSelectOption[] = [
    { value: "1", label: "Ongoing" },
    { value: "2", label: "Done" },
    { value: "3", label: "On hold" },
];

describe("InputMultiSelect", () => {
    afterEach(() => {
        cleanup();
    });

    it("shows empty, single, and count labels on the activator", () => {
        const { rerender } = renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={vi.fn()}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        expect(screen.getByRole("button", { name: "Tag filter" })).toHaveTextContent("No filter");

        rerender(
            <InputMultiSelect
                value={["1"]}
                onChange={vi.fn()}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        expect(screen.getByRole("button", { name: "Tag filter" })).toHaveTextContent("Ongoing");

        rerender(
            <InputMultiSelect
                value={["1", "2"]}
                onChange={vi.fn()}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        expect(screen.getByRole("button", { name: "Tag filter" })).toHaveTextContent("2 selected");
    });

    it("toggles options without closing the panel", () => {
        const onChange = vi.fn();
        renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={onChange}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Tag filter" }));
        const dialog = screen.getByRole("dialog", { name: "Tag filter" });
        fireEvent.click(within(dialog).getByRole("checkbox", { name: "Ongoing" }));
        expect(onChange).toHaveBeenCalledWith(["1"]);
        expect(screen.getByRole("dialog", { name: "Tag filter" })).toBeInTheDocument();
    });

    it("toggles an option when clicking the row label outside the checkbox", () => {
        const onChange = vi.fn();
        renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={onChange}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Tag filter" }));
        const dialog = screen.getByRole("dialog", { name: "Tag filter" });
        fireEvent.click(within(dialog).getByText("Done"));
        expect(onChange).toHaveBeenCalledWith(["2"]);
    });

    it("closes the panel on Escape and refocuses the activator", async () => {
        renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={vi.fn()}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        const activator = screen.getByRole("button", { name: "Tag filter" });
        fireEvent.click(activator);
        const dialog = screen.getByRole("dialog", { name: "Tag filter" });
        fireEvent.keyDown(within(dialog).getByRole("option", { name: "Ongoing" }), { key: "Escape" });
        expect(screen.queryByRole("dialog", { name: "Tag filter" })).toBeNull();
        await waitFor(() => {
            expect(activator).toHaveFocus();
        });
    });

    it("selects and clears all enabled options from the toggle-all control", () => {
        const onChange = vi.fn();
        const { unmount } = renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={onChange}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Tag filter" }));
        fireEvent.click(screen.getByRole("button", { name: "Select all" }));
        expect(onChange).toHaveBeenCalledWith(["1", "2", "3"]);

        unmount();
        onChange.mockClear();
        renderWithProviders(
            <InputMultiSelect
                value={["1", "2", "3"]}
                onChange={onChange}
                options={options}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Tag filter" }));
        fireEvent.click(screen.getByRole("button", { name: "Unselect all" }));
        expect(onChange).toHaveBeenCalledWith([]);
    });

    it("skips disabled options when selecting all", () => {
        const onChange = vi.fn();
        renderWithProviders(
            <InputMultiSelect
                value={[]}
                onChange={onChange}
                options={[...options, { value: "9", label: "Skip", disabled: true }]}
                emptyLabel="No filter"
                multipleLabel={(count) => `${count} selected`}
                toggleAllLabel={(all) => (all ? "Unselect all" : "Select all")}
                aria-label="Tag filter"
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Tag filter" }));
        fireEvent.click(screen.getByRole("button", { name: "Select all" }));
        expect(onChange).toHaveBeenCalledWith(["1", "2", "3"]);
    });
});
