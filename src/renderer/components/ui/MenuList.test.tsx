import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MenuList from "./MenuList";

const { optSelectState, rowAction } = vi.hoisted(() => ({
    optSelectState: { current: null as Menu.OptSelectData | null },
    rowAction: vi.fn(),
}));

vi.mock("../../App", () => ({
    useAppContext: () => ({ optSelectData: optSelectState.current }),
}));

/** MenuList payload: retainFocus list with a grouped row and a plain row. */
const menuWithDescription = (): Menu.OptSelectData => {
    const elemBox = document.createElement("div");
    document.body.appendChild(elemBox);
    return {
        items: [
            { label: "Alpha", description: "Group", action: rowAction },
            { label: "Beta", action: () => undefined },
        ],
        elemBox,
        retainFocus: true,
    };
};

describe("MenuList", () => {
    afterEach(() => {
        cleanup();
        const box = optSelectState.current?.elemBox;
        if (box instanceof HTMLElement) box.remove();
        optSelectState.current = null;
        rowAction.mockClear();
    });

    beforeEach(() => {
        optSelectState.current = menuWithDescription();
    });

    it("renders description in a separate muted span, not concatenated into the label", () => {
        renderWithProviders(<MenuList />);
        const label = screen.getByText("Alpha");
        const desc = screen.getByText("Group");
        expect(label.className).toContain("itemListLabel");
        expect(desc.className).toContain("itemListDesc");
        expect(label.textContent).toBe("Alpha");
    });

    it("activates a retainFocus row on click", () => {
        renderWithProviders(<MenuList />);
        fireEvent.click(screen.getByText("Alpha"));
        expect(rowAction).toHaveBeenCalled();
    });
});
