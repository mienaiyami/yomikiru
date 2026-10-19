import { renderHook } from "@testing-library/react-hooks/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useHeldScroll } from "./useHeldScroll";

describe("useHeldScroll", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("scrolls on each animation frame until stop", () => {
        const pending: FrameRequestCallback[] = [];
        let nextRafId = 1;
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            pending.push(cb);
            return nextRafId++;
        });
        vi.stubGlobal("cancelAnimationFrame", () => {
            pending.length = 0;
        });

        const scrollBy = vi.fn();
        const { result } = renderHook(() => useHeldScroll(scrollBy));
        result.current.start(12);
        expect(scrollBy).not.toHaveBeenCalled();

        const first = pending.shift();
        first?.(0);
        expect(scrollBy).toHaveBeenCalledTimes(1);
        expect(scrollBy).toHaveBeenLastCalledWith(12);

        result.current.stop();
        const leftover = pending.shift();
        leftover?.(1);
        expect(scrollBy).toHaveBeenCalledTimes(1);
    });
});
