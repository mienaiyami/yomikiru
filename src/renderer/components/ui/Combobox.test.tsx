import { renderWithProviders } from "@test/renderWithProviders";
import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Combobox, { type ComboboxOption } from "./Combobox";

const { setOptSelectData } = vi.hoisted(() => ({
    setOptSelectData: vi.fn(),
}));

vi.mock("@renderer/App", () => ({
    useAppContext: () => ({ setOptSelectData }),
}));

const options: ComboboxOption[] = [
    { value: "a", label: "Alpha", description: "One" },
    { value: "b", label: "Beta", description: "Two" },
];

/** Last non-null menu payload passed to {@link setOptSelectData}. */
const lastMenu = (): Menu.OptSelectData | null => {
    for (let i = setOptSelectData.mock.calls.length - 1; i >= 0; i--) {
        const arg = setOptSelectData.mock.calls[i]?.[0];
        if (arg && typeof arg === "object" && "items" in arg) return arg as Menu.OptSelectData;
    }
    return null;
};

describe("Combobox", () => {
    afterEach(() => {
        cleanup();
        setOptSelectData.mockClear();
    });

    it("does not open MenuList until the query is non-empty", () => {
        const onChange = vi.fn();
        renderWithProviders(
            <Combobox value="" onChange={onChange} options={options} onSelect={vi.fn()} placeholder="Find" />,
        );
        expect(lastMenu()).toBeNull();
        fireEvent.change(screen.getByPlaceholderText("Find"), { target: { value: "a" } });
        expect(onChange).toHaveBeenCalledWith("a");
    });

    it("publishes retainFocus MenuList items and selects via item action", () => {
        const onSelect = vi.fn();
        const onChange = vi.fn();
        renderWithProviders(
            <Combobox value="al" onChange={onChange} options={options} onSelect={onSelect} placeholder="Find" />,
        );
        const menu = lastMenu();
        expect(menu?.retainFocus).toBe(true);
        expect(menu?.items[0]?.label).toBe("Alpha");
        expect(menu?.items[0]?.description).toBe("One");
        expect(menu?.items[0]?.label.includes("One")).toBe(false);
        menu?.items.find((item) => item.label.includes("Alpha"))?.action();
        expect(onSelect).toHaveBeenCalledWith("a");
        expect(onChange).toHaveBeenCalledWith("");
    });

    it("selects the active option on Enter", () => {
        const onSelect = vi.fn();
        renderWithProviders(
            <Combobox value="be" onChange={vi.fn()} options={options} onSelect={onSelect} placeholder="Find" />,
        );
        const input = screen.getByPlaceholderText("Find");
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        expect(onSelect).toHaveBeenCalledWith("a");
    });

    it("moves the active option with ArrowDown then Enter", () => {
        const onSelect = vi.fn();
        renderWithProviders(
            <Combobox value="be" onChange={vi.fn()} options={options} onSelect={onSelect} placeholder="Find" />,
        );
        const input = screen.getByPlaceholderText("Find");
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
        expect(onSelect).toHaveBeenCalledWith("b");
    });

    it("does not republish MenuList on arrow keys", () => {
        renderWithProviders(
            <Combobox value="be" onChange={vi.fn()} options={options} onSelect={vi.fn()} placeholder="Find" />,
        );
        const callsAfterOpen = setOptSelectData.mock.calls.length;
        const input = screen.getByPlaceholderText("Find");
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(input, { key: "ArrowDown", code: "ArrowDown" });
        fireEvent.keyDown(input, { key: "ArrowUp", code: "ArrowUp" });
        expect(setOptSelectData.mock.calls.length).toBe(callsAfterOpen);
    });

    it("clears a non-empty value on Escape without calling onDismiss", () => {
        const onChange = vi.fn();
        const onDismiss = vi.fn();
        renderWithProviders(
            <Combobox
                value="x"
                onChange={onChange}
                options={[]}
                onSelect={vi.fn()}
                onDismiss={onDismiss}
                emptyMessage="None"
                placeholder="Find"
            />,
        );
        fireEvent.keyDown(screen.getByPlaceholderText("Find"), { key: "Escape", code: "Escape" });
        expect(onChange).toHaveBeenCalledWith("");
        expect(onDismiss).not.toHaveBeenCalled();
    });

    it("calls onDismiss on Escape when the value is empty", () => {
        const onDismiss = vi.fn();
        renderWithProviders(
            <Combobox
                value=""
                onChange={vi.fn()}
                options={[]}
                onSelect={vi.fn()}
                onDismiss={onDismiss}
                placeholder="Find"
            />,
        );
        fireEvent.keyDown(screen.getByPlaceholderText("Find"), { key: "Escape", code: "Escape" });
        expect(onDismiss).toHaveBeenCalled();
    });

    it("stops keydown bubbling so window shortcuts do not fire", () => {
        const onWindow = vi.fn();
        window.addEventListener("keydown", onWindow);
        renderWithProviders(
            <Combobox value="a" onChange={vi.fn()} options={options} onSelect={vi.fn()} placeholder="Find" />,
        );
        fireEvent.keyDown(screen.getByPlaceholderText("Find"), { key: "s", code: "KeyS", bubbles: true });
        window.removeEventListener("keydown", onWindow);
        expect(onWindow).not.toHaveBeenCalled();
    });

    it("closes MenuList on input blur", () => {
        renderWithProviders(
            <Combobox value="al" onChange={vi.fn()} options={options} onSelect={vi.fn()} placeholder="Find" />,
        );
        expect(lastMenu()).not.toBeNull();
        fireEvent.blur(screen.getByPlaceholderText("Find"));
        expect(setOptSelectData).toHaveBeenCalledWith(null);
    });
});
