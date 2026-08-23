import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SelectionCheckbox from "./SelectionCheckbox";

describe("SelectionCheckbox", () => {
    afterEach(() => {
        cleanup();
    });

    it("forwards click with shiftKey and blocks bubbling", () => {
        const onToggle = vi.fn();
        const parentClick = vi.fn();
        const { getByLabelText } = render(
            <div onClick={parentClick}>
                <SelectionCheckbox checked={false} onToggle={onToggle} ariaLabel="Select row" />
            </div>,
        );

        fireEvent.click(getByLabelText("Select row"), { shiftKey: true });
        expect(onToggle).toHaveBeenCalledWith({ shiftKey: true });
        expect(parentClick).not.toHaveBeenCalled();
    });

    it("reflects checked state on the input", () => {
        const { getByRole, rerender } = render(
            <SelectionCheckbox checked={false} onToggle={vi.fn()} ariaLabel="Pick" />,
        );
        expect(getByRole("checkbox")).not.toBeChecked();
        rerender(<SelectionCheckbox checked onToggle={vi.fn()} ariaLabel="Pick" />);
        expect(getByRole("checkbox")).toBeChecked();
    });

    it("stays out of the tab order unless tabIndex is set", () => {
        const { getByRole, rerender } = render(
            <SelectionCheckbox checked={false} onToggle={vi.fn()} ariaLabel="Pick" />,
        );
        expect(getByRole("checkbox")).toHaveAttribute("tabIndex", "-1");
        rerender(<SelectionCheckbox checked={false} onToggle={vi.fn()} ariaLabel="Pick" tabIndex={0} />);
        expect(getByRole("checkbox")).toHaveAttribute("tabIndex", "0");
    });

    it("toggles from Space without bubbling", () => {
        const onToggle = vi.fn();
        const parentKey = vi.fn();
        const { getByRole } = render(
            <div onKeyDown={parentKey}>
                <SelectionCheckbox checked={false} onToggle={onToggle} ariaLabel="Pick" tabIndex={0} />
            </div>,
        );
        fireEvent.keyDown(getByRole("checkbox"), { key: " " });
        expect(onToggle).toHaveBeenCalledWith({ shiftKey: false });
        expect(parentKey).not.toHaveBeenCalled();
    });
});
