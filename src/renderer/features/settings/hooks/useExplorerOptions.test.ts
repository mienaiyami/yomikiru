import { onInvoke } from "@test/mocks/preload";
import { act, renderHook } from "@testing-library/react-hooks/dom";
import { describe, expect, it, vi } from "vitest";
import { useExplorerOptions } from "./useExplorerOptions";

describe("useExplorerOptions", () => {
    it("invokes explorer channel and shows success confirm", async () => {
        onInvoke("explorer:addOption", async () => true);
        const confirm = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:confirm", confirm);

        const { result } = renderHook(() => useExplorerOptions());
        let ok = false;
        await act(async () => {
            ok = await result.current.handleInvoke("explorer:addOption", "Added");
        });
        expect(ok).toBe(true);
        expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ message: "Added", noOption: true }));
        expect(result.current.isUpdating).toBe(false);
    });

    it("returns false and surfaces nodeError on failure", async () => {
        onInvoke("explorer:removeOption", async () => {
            throw Object.assign(new Error("denied"), { name: "Error", errno: 1 });
        });
        const nodeError = vi.fn(async () => ({ response: 0, checkboxChecked: false }));
        onInvoke("dialog:nodeError", nodeError);

        const { result } = renderHook(() => useExplorerOptions());
        let ok = true;
        await act(async () => {
            ok = await result.current.handleInvoke("explorer:removeOption");
        });
        expect(ok).toBe(false);
        expect(nodeError).toHaveBeenCalled();
    });
});
