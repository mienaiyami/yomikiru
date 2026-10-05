import { renderWithProviders } from "@test/renderWithProviders";
import { fireEvent, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Shortcuts from "./Shortcuts";

/**
 * Add control in a command row: button while idle, text field while recording.
 */
const addControlIn = (commandId: string): HTMLElement => {
    const row = document.getElementById(`settings-shortcut-${commandId}`);
    const add = row?.querySelector(".addNewKey");
    if (!(add instanceof HTMLElement)) throw new Error(`missing add control for ${commandId}`);
    return add;
};

describe("Shortcuts editor", () => {
    it("lists catalog commands in grouped settings sections", () => {
        renderWithProviders(<Shortcuts />);
        expect(document.getElementById("settings-shortcuts-help")).toBeTruthy();
        expect(document.getElementById("settings-shortcut-navToHome")).toBeTruthy();
        expect(screen.getByText("New Window")).toBeTruthy();
        expect(screen.getByRole("heading", { name: "Window" })).toBeTruthy();
        expect(screen.getAllByRole("button", { name: "Remove binding" }).length).toBeGreaterThan(0);
    });

    it("records a new binding from the add control", async () => {
        renderWithProviders(<Shortcuts />);
        const homeRow = document.getElementById("settings-shortcut-navToHome");
        fireEvent.click(addControlIn("navToHome"));
        fireEvent.keyDown(window, { key: "G", code: "KeyG", bubbles: true });
        expect(await within(homeRow as HTMLElement).findByText("G")).toBeTruthy();
    });

    it("records Shift+Space from the capture field", async () => {
        renderWithProviders(<Shortcuts />);
        const homeRow = document.getElementById("settings-shortcut-navToHome") as HTMLElement;
        fireEvent.click(addControlIn("navToHome"));
        fireEvent.keyDown(window, { key: " ", code: "Space", shiftKey: true, bubbles: true });
        expect(await within(homeRow).findByTitle("shift+Space")).toBeTruthy();
    });

    it("cancels recording on Escape without saving a binding", () => {
        renderWithProviders(<Shortcuts />);
        const homeRow = document.getElementById("settings-shortcut-navToHome") as HTMLElement;
        fireEvent.click(addControlIn("navToHome"));
        expect(homeRow.querySelector("input.addNewKey")).toBeTruthy();
        fireEvent.keyDown(window, { key: "Escape", code: "Escape", bubbles: true });
        expect(homeRow.querySelector("input.addNewKey")).toBeFalsy();
        expect(homeRow.querySelector("button.addNewKey")).toBeTruthy();
        expect(within(homeRow).queryByText("Escape")).toBeNull();
    });

    it("keeps a duplicate assignment and notes the shared key", async () => {
        renderWithProviders(<Shortcuts />);
        const homeRow = document.getElementById("settings-shortcut-navToHome") as HTMLElement;
        fireEvent.click(addControlIn("navToHome"));
        fireEvent.keyDown(window, { key: "/", code: "Slash", bubbles: true });
        const alert = await within(homeRow).findByText(/Competes with/);
        expect(within(alert).getByText("Focus search").tagName).toBe("A");
        expect(alert.textContent).not.toMatch(/Focus search.*Focus search/);
    });
});
