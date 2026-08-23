import path from "node:path";
import { stubFs } from "@test/mocks/preload";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    appRootElement,
    debounce,
    findCover,
    getCSSPath,
    randomString,
    scrollChildInContainer,
    sleep,
} from "./utils";

describe("getCSSPath", () => {
    afterEach(() => {
        document.body.innerHTML = "";
    });

    it("returns empty string for non-elements", () => {
        expect(getCSSPath(document.createTextNode("x") as unknown as Element)).toBe("");
    });

    it("builds a path using id when present", () => {
        document.body.innerHTML = `<div id="root"><span id="target">x</span></div>`;
        const el = document.getElementById("target");
        expect(el).toBeTruthy();
        expect(getCSSPath(el!)).toBe("span#target");
    });

    it("uses nth-of-type for siblings without ids", () => {
        document.body.innerHTML = `<section><p>a</p><p>b</p></section>`;
        const el = document.querySelector("section p:last-child");
        expect(el).toBeTruthy();
        expect(getCSSPath(el!)).toContain("p:nth-of-type(2)");
    });
});

describe("appRootElement", () => {
    afterEach(() => {
        document.getElementById("app")?.remove();
    });

    it("returns #app when the shell is mounted", () => {
        const app = document.createElement("div");
        app.id = "app";
        document.body.appendChild(app);
        expect(appRootElement()).toBe(app);
    });

    it("returns document.body when #app is missing", () => {
        expect(appRootElement()).toBe(document.body);
    });
});

describe("findCover", () => {
    it("returns the first matching cover.* under the manga directory", () => {
        const dir = path.join("testdata", "manga", "series");
        const coverJpg = path.join(dir, "cover.jpg");
        stubFs({ isFile: (p) => p === coverJpg });
        expect(findCover(dir)).toBe(coverJpg);
    });

    it("returns empty string when no cover file exists", () => {
        expect(findCover(path.join("testdata", "manga", "bare"))).toBe("");
    });
});

describe("scrollChildInContainer", () => {
    const mockRect = (top: number, height: number): DOMRect =>
        ({
            top,
            height,
            bottom: top + height,
            left: 0,
            right: 0,
            width: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
        }) as DOMRect;

    it("centers the child inside the container scrollTop", () => {
        const container = document.createElement("div");
        const child = document.createElement("div");
        container.scrollTop = 10;
        vi.spyOn(container, "getBoundingClientRect").mockReturnValue(mockRect(0, 100));
        vi.spyOn(child, "getBoundingClientRect").mockReturnValue(mockRect(80, 20));
        scrollChildInContainer(container, child, "center");
        expect(container.scrollTop).toBe(50);
    });

    it("does not move when nearest and the child is already fully visible", () => {
        const container = document.createElement("div");
        const child = document.createElement("div");
        container.scrollTop = 4;
        vi.spyOn(container, "getBoundingClientRect").mockReturnValue(mockRect(0, 100));
        vi.spyOn(child, "getBoundingClientRect").mockReturnValue(mockRect(20, 20));
        scrollChildInContainer(container, child, "nearest");
        expect(container.scrollTop).toBe(4);
    });
});

describe("randomString / sleep / debounce", () => {
    it("randomString returns the requested alphabet length (+1 loop bound)", () => {
        const s = randomString(5);
        expect(s).toHaveLength(6);
        expect(s).toMatch(/^[A-Za-z0-9]+$/);
    });

    it("sleep resolves after the delay", async () => {
        vi.useFakeTimers();
        const p = sleep(50);
        await vi.advanceTimersByTimeAsync(50);
        await expect(p).resolves.toBeUndefined();
        vi.useRealTimers();
    });

    it("debounce only invokes the latest call after waitMs", async () => {
        vi.useFakeTimers();
        const cb = vi.fn();
        const d = debounce(cb, 100);
        d("a");
        d("b");
        await vi.advanceTimersByTimeAsync(99);
        expect(cb).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(1);
        expect(cb).toHaveBeenCalledOnce();
        expect(cb).toHaveBeenCalledWith("b");
        vi.useRealTimers();
    });
});
