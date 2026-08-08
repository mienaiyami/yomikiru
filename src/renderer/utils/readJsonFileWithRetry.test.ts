import { describe, expect, it, vi } from "vitest";
import { readJsonFileWithRetry, readJsonFileWithRetrySync } from "./readJsonFileWithRetry";

describe("readJsonFileWithRetrySync", () => {
    it("parses valid JSON on the first read", () => {
        window.fs.readFileSync = ((_path) => '{"a":1}') as typeof window.fs.readFileSync;
        expect(readJsonFileWithRetrySync<{ a: number }>("x.json")).toEqual({ a: 1 });
    });

    it("retries empty/invalid JSON then succeeds", () => {
        const onRetry = vi.fn();
        const reads = ["", "{bad", '{"ok":true}'];
        window.fs.readFileSync = ((_path) => reads.shift() ?? "") as typeof window.fs.readFileSync;
        expect(
            readJsonFileWithRetrySync("x.json", {
                maxAttempts: 5,
                onRetry,
            }),
        ).toEqual({ ok: true });
        expect(onRetry).toHaveBeenCalled();
    });

    it("throws the last parse error when retries are exhausted", () => {
        window.fs.readFileSync = ((_path) => "{") as typeof window.fs.readFileSync;
        expect(() => readJsonFileWithRetrySync("x.json", { maxAttempts: 2 })).toThrow(SyntaxError);
    });
});

describe("readJsonFileWithRetry", () => {
    it("retries asynchronously with delay", async () => {
        vi.useFakeTimers();
        const reads = ["", '{"n":2}'];
        window.fs.readFile = (async (_path) => reads.shift() ?? "") as typeof window.fs.readFile;
        const pending = readJsonFileWithRetry<{ n: number }>("y.json", {
            maxAttempts: 3,
            delayMs: 10,
        });
        await vi.advanceTimersByTimeAsync(10);
        await expect(pending).resolves.toEqual({ n: 2 });
        vi.useRealTimers();
    });
});
