import { renderWithProviders } from "@test/renderWithProviders";
import { describe, expect, it } from "vitest";
import { useCommandOwner } from "./useCommandOwner";

/** `MouseEvent.button` for the back side button. */
const MOUSE_BACK_BUTTON = 3;

const sideClick = (eventType: "mousedown" | "mouseup" | "auxclick"): MouseEvent =>
    new MouseEvent(eventType, { button: MOUSE_BACK_BUTTON, bubbles: true, cancelable: true });

describe("KeybindingProvider side buttons", () => {
    it("runs the page command once and cancels browser history on release", () => {
        const calls: string[] = [];
        const Reader = () => {
            useCommandOwner({
                ownerId: "manga",
                contextKinds: ["mangaReader"],
                visible: true,
                handlers: {
                    prevPage: () => {
                        calls.push("prev");
                    },
                },
            });
            return null;
        };
        renderWithProviders(<Reader />);
        window.dispatchEvent(sideClick("mousedown"));
        const up = sideClick("mouseup");
        const aux = sideClick("auxclick");
        window.dispatchEvent(up);
        window.dispatchEvent(aux);
        expect(calls).toEqual(["prev"]);
        expect(up.defaultPrevented).toBe(true);
        expect(aux.defaultPrevented).toBe(false);
    });
});
