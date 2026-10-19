import { describe, expect, it, vi } from "vitest";
import { Logger } from "./Logger";
import type { ScopedLogSink } from "./types";

describe("Logger", () => {
    it("delegates each level to the sink", () => {
        const sink: ScopedLogSink = {
            log: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn(),
            verbose: vi.fn(),
        };
        const log = new Logger(sink);
        log.log("a");
        log.info("b");
        log.error("c");
        log.warn("d");
        log.debug("e");
        log.verbose("f");
        expect(sink.log).toHaveBeenCalledWith("a");
        expect(sink.info).toHaveBeenCalledWith("b");
        expect(sink.error).toHaveBeenCalledWith("c");
        expect(sink.warn).toHaveBeenCalledWith("d");
        expect(sink.debug).toHaveBeenCalledWith("e");
        expect(sink.verbose).toHaveBeenCalledWith("f");
    });
});
