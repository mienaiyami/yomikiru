import { emptyKeymapDocument } from "@common/keybindings";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createKeybindingRuntime } from "./runtime";
import { KeybindingRuntimeContext } from "./runtimeContext";
import { useCommandOwner, useOwnerId } from "./useCommandOwner";

describe("useCommandOwner", () => {
    it("invokes the handler from the latest render, not a stale closure", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const Owner = ({ label }: { label: string }) => {
            useCommandOwner({
                ownerId: "app",
                contextKinds: ["app"],
                visible: true,
                handlers: {
                    navToHome: () => {
                        calls.push(label);
                    },
                },
            });
            return null;
        };
        const { rerender } = render(
            <KeybindingRuntimeContext.Provider value={runtime}>
                <Owner label="a" />
            </KeybindingRuntimeContext.Provider>,
        );
        const pressH = () =>
            runtime.handleKeyDown(
                new KeyboardEvent("keydown", { code: "KeyH", key: "h", bubbles: true, cancelable: true }),
            );
        pressH();
        expect(calls).toEqual(["a"]);
        rerender(
            <KeybindingRuntimeContext.Provider value={runtime}>
                <Owner label="b" />
            </KeybindingRuntimeContext.Provider>,
        );
        pressH();
        expect(calls).toEqual(["a", "b"]);
    });

    it("keeps the same owner id across rerenders and differs per mount", () => {
        const Probe = ({ kind, testId }: { kind: string; testId: string }) => {
            const ownerId = useOwnerId(kind);
            return <span data-testid={testId}>{ownerId}</span>;
        };
        const { rerender, getByTestId } = render(<Probe kind="modal" testId="first" />);
        const first = getByTestId("first").textContent;
        expect(first?.startsWith("modal:")).toBe(true);
        rerender(<Probe kind="modal" testId="first" />);
        expect(getByTestId("first").textContent).toBe(first);

        rerender(
            <>
                <Probe kind="modal" testId="first" />
                <Probe kind="modal" testId="second" />
            </>,
        );
        expect(getByTestId("second").textContent).not.toBe(first);
        expect(getByTestId("second").textContent?.startsWith("modal:")).toBe(true);
    });
});
