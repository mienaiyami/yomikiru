import { renderWithI18n } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Popover from "./Popover";

/**
 * Uncontrolled popover with a text field in the panel so focus trap can be asserted.
 */
const PopoverWithField = () => (
    <div>
        <button type="button">outside</button>
        <Popover trigger={<button type="button">open</button>} label="Grid size">
            <label>
                Size
                <input aria-label="size" type="text" />
            </label>
        </Popover>
    </div>
);

describe("Popover", () => {
    afterEach(() => {
        cleanup();
    });

    it("traps focus inside the panel while open", async () => {
        renderWithI18n(<PopoverWithField />);
        fireEvent.click(screen.getByRole("button", { name: "open" }));
        const dialog = screen.getByRole("dialog", { name: "Grid size" });
        expect(dialog).toHaveAttribute("aria-modal", "true");

        await waitFor(() => {
            expect(dialog.contains(document.activeElement)).toBe(true);
        });

        const size = screen.getByLabelText("size");
        size.focus();
        expect(document.activeElement).toBe(size);

        fireEvent.keyDown(size, { key: "Tab" });
        expect(dialog.contains(document.activeElement)).toBe(true);
        expect(screen.getByRole("button", { name: "outside" })).not.toHaveFocus();
    });
});
