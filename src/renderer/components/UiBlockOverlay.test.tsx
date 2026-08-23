import { blockUi, unblockUi } from "@store/ui";
import { renderWithProviders } from "@test/renderWithProviders";
import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import UiBlockOverlay from "./UiBlockOverlay";

describe("UiBlockOverlay", () => {
    it("is absent until a UI lock is dispatched", () => {
        const { container } = renderWithProviders(<UiBlockOverlay />);
        expect(container.querySelector("#uiBlockOverlay")).toBeNull();
    });

    it("shows the top lock message and swallows capture-phase keydown", () => {
        const { store, getByLabelText } = renderWithProviders(<UiBlockOverlay />);
        act(() => {
            store.dispatch(blockUi({ id: "scan", message: "Scanning..." }));
        });
        expect(getByLabelText("Scanning...")).toBeInTheDocument();

        let reachedBubble = false;
        let reachedLaterCapture = false;
        const onBubble = () => {
            reachedBubble = true;
        };
        const onLaterCapture = () => {
            reachedLaterCapture = true;
        };
        window.addEventListener("keydown", onBubble);
        window.addEventListener("keydown", onLaterCapture, true);
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
        window.removeEventListener("keydown", onBubble);
        window.removeEventListener("keydown", onLaterCapture, true);
        expect(reachedBubble).toBe(false);
        expect(reachedLaterCapture).toBe(false);

        act(() => {
            store.dispatch(unblockUi("scan"));
        });
        expect(document.querySelector("#uiBlockOverlay")).toBeNull();
    });
});
