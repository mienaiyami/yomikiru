import { afterEach, describe, expect, it } from "vitest";
import { libraryIo, setLibraryIo } from "./io";

describe("libraryIo", () => {
    afterEach(() => {
        setLibraryIo(() => ({ fs: window.fs, path: window.path }));
    });

    it("reads a factory on each call so replaced fs/path objects are visible", () => {
        let calls = 0;
        const { fs, path } = libraryIo();
        setLibraryIo(() => {
            calls += 1;
            return { fs, path };
        });
        libraryIo();
        libraryIo();
        expect(calls).toBe(2);
    });
});
