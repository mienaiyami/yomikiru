import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Modal from "./Modal";

describe("Modal", () => {
    afterEach(() => {
        cleanup();
    });

    it("closes on Escape without notifying a React ancestor", () => {
        const onParentEsc = vi.fn();
        const onClose = vi.fn();
        render(
            <div
                onKeyDown={(e) => {
                    if (e.key === "Escape") onParentEsc();
                }}
            >
                <Modal open onClose={onClose}>
                    <button type="button">inside</button>
                </Modal>
            </div>,
        );
        fireEvent.keyDown(screen.getByRole("button", { name: "inside" }), { key: "Escape" });
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(onParentEsc).not.toHaveBeenCalled();
    });

    it("does not preventDefault Space when the target is a text field", () => {
        render(
            <Modal open onClose={vi.fn()}>
                <textarea aria-label="note" />
            </Modal>,
        );
        const field = screen.getByRole("textbox", { name: "note" });
        expect(fireEvent.keyDown(field, { key: " ", code: "Space" })).toBe(true);
    });

    it("does not preventDefault Space on a button inside the overlay", () => {
        render(
            <Modal open onClose={vi.fn()}>
                <button type="button">cancel</button>
            </Modal>,
        );
        const cancel = screen.getByRole("button", { name: "cancel" });
        expect(fireEvent.keyDown(cancel, { key: " ", code: "Space" })).toBe(true);
    });
});
