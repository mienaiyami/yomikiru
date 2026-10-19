import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResizeObserverRafWidth } from "./useResizeObserverRafWidth";

type ObserverCallback = (entries: ResizeObserverEntry[]) => void;

/**
 * Probe that publishes the hook width so tests can assert the committed value.
 */
const WidthProbe = () => {
    const [ref, width] = useResizeObserverRafWidth<HTMLDivElement>();
    return <div ref={ref} data-testid="box" data-width={width} />;
};

/**
 * Delivers one ResizeObserver entry for the probe element.
 */
const emitWidth = (callback: ObserverCallback, rawWidth: number) => {
    const target = screen.getByTestId("box");
    callback([
        {
            target,
            contentRect: { width: rawWidth, height: 40, x: 0, y: 0, top: 0, left: 0, bottom: 40, right: rawWidth },
        } as ResizeObserverEntry,
    ]);
};

describe("useResizeObserverRafWidth", () => {
    let callback: ObserverCallback | undefined;
    let queuedFrame: FrameRequestCallback | null = null;

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
        callback = undefined;
        queuedFrame = null;
    });

    /**
     * Stubs animation frames and ResizeObserver so a test can deliver widths itself.
     */
    const installObservers = () => {
        vi.stubGlobal("requestAnimationFrame", (frame: FrameRequestCallback) => {
            queuedFrame = frame;
            return 1;
        });
        vi.stubGlobal("cancelAnimationFrame", () => {
            queuedFrame = null;
        });
        class RecordingResizeObserver {
            constructor(next: ObserverCallback) {
                callback = next;
            }
            observe(): void {
                // tests deliver entries through {@link emitWidth}
            }
            unobserve(): void {
                // no-op stub
            }
            disconnect(): void {
                // no-op stub
            }
        }
        vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
    };

    const flushFrame = () => {
        const frame = queuedFrame;
        queuedFrame = null;
        frame?.(0);
    };

    it("keeps the last laid-out width when the element is display none", () => {
        installObservers();
        render(<WidthProbe />);
        if (!callback) throw new Error("ResizeObserver was not constructed");
        const observer = callback;

        act(() => {
            emitWidth(observer, 480);
            flushFrame();
        });
        expect(screen.getByTestId("box").dataset.width).toBe("480");

        screen.getByTestId("box").style.display = "none";
        act(() => {
            emitWidth(observer, 0);
            flushFrame();
        });
        expect(screen.getByTestId("box").dataset.width).toBe("480");
    });

    it("keeps the last laid-out width when an ancestor is display none", () => {
        installObservers();
        render(
            <div data-testid="parent">
                <WidthProbe />
            </div>,
        );
        if (!callback) throw new Error("ResizeObserver was not constructed");
        const observer = callback;

        act(() => {
            emitWidth(observer, 480);
            flushFrame();
        });
        expect(screen.getByTestId("box").dataset.width).toBe("480");

        screen.getByTestId("parent").style.display = "none";
        act(() => {
            emitWidth(observer, 0);
            flushFrame();
        });
        expect(screen.getByTestId("box").dataset.width).toBe("480");
    });

    it("commits content-box width before paint", () => {
        installObservers();
        const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(168);
        const PaddedProbe = () => {
            const [ref, width] = useResizeObserverRafWidth<HTMLDivElement>();
            return <div ref={ref} data-testid="padded" data-width={width} style={{ padding: "16px" }} />;
        };
        render(<PaddedProbe />);
        expect(screen.getByTestId("padded").dataset.width).toBe("136");
        clientWidth.mockRestore();
    });

    it("commits a real zero width while the element is displayed", () => {
        installObservers();
        render(<WidthProbe />);
        if (!callback) throw new Error("ResizeObserver was not constructed");
        const observer = callback;

        act(() => {
            emitWidth(observer, 480);
            flushFrame();
        });
        act(() => {
            emitWidth(observer, 0);
            flushFrame();
        });
        expect(screen.getByTestId("box").dataset.width).toBe("0");
    });
});
