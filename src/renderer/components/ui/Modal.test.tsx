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
});
