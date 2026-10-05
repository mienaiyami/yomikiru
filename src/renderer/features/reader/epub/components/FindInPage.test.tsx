import { useCommandOwner } from "@features/keybindings";
import { renderWithProviders } from "@test/renderWithProviders";
import { act, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { BOOK_READER_OWNER_ID } from "../useBookCommandOwner";
import FindInPage from "./FindInPage";

/**
 * Find-in-page plus a book-reader Escape owner. Used to prove the nested
 * find owner blurs the field instead of exiting zen.
 */
const FindWithBookEscape = ({ onBookEscape }: { onBookEscape: () => void }) => {
    useCommandOwner({
        ownerId: BOOK_READER_OWNER_ID,
        contextKinds: ["bookReader"],
        visible: true,
        onEscape: () => {
            onBookEscape();
            return true;
        },
    });
    return <FindInPage findInPage={vi.fn()} />;
};

describe("FindInPage", () => {
    it("blurs on Escape without running the book reader zen-exit owner", () => {
        const onBookEscape = vi.fn();
        const { container } = renderWithProviders(<FindWithBookEscape onBookEscape={onBookEscape} />);
        const input = container.querySelector("input");
        expect(input).toBeTruthy();
        act(() => {
            input?.focus();
        });
        expect(document.activeElement).toBe(input);
        act(() => {
            fireEvent.keyDown(input as HTMLInputElement, { key: "Escape", code: "Escape", bubbles: true });
        });
        expect(document.activeElement).not.toBe(input);
        expect(onBookEscape).not.toHaveBeenCalled();
    });

    it("runs find next on Enter and previous on Shift+Enter", () => {
        const findInPage = vi.fn();
        const { container } = renderWithProviders(<FindInPage findInPage={findInPage} />);
        const input = container.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "needle" } });
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        fireEvent.keyDown(input, { key: "Enter", code: "Enter", shiftKey: true });
        expect(findInPage).toHaveBeenNthCalledWith(1, "needle");
        expect(findInPage).toHaveBeenNthCalledWith(2, "needle", false);
    });

    it("lets the book reader handle Escape when find is not focused", () => {
        const Probe = () => {
            const [exited, setExited] = useState(false);
            return (
                <>
                    <FindWithBookEscape onBookEscape={() => setExited(true)} />
                    {exited ? <span>zen-exit</span> : null}
                </>
            );
        };
        const { container, queryByText } = renderWithProviders(<Probe />);
        const input = container.querySelector("input");
        expect(document.activeElement).not.toBe(input);
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }));
        });
        expect(queryByText("zen-exit")).toBeTruthy();
    });
});
