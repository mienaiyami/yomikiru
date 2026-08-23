import { describe, expect, it, vi } from "vitest";
import { createRendererLogger } from "./logger";

describe("createRendererLogger", () => {
    it("scopes a Logger through window.createRendererLogSink", () => {
        const sinkFactory = vi.spyOn(window, "createRendererLogSink");
        const log = createRendererLogger("utils/example");
        expect(sinkFactory).toHaveBeenCalledWith("utils/example");
        expect(typeof log.log).toBe("function");
        expect(typeof log.error).toBe("function");
        sinkFactory.mockRestore();
    });
});
