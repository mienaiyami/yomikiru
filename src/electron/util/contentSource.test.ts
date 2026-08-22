import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { unzip } = vi.hoisted(() => ({ unzip: vi.fn() }));

vi.mock("cross-zip", () => ({ unzip }));
vi.mock("@electron/util/logger", () => ({
    createMainLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

import { withResolvedFirstImage } from "./contentSource";

describe("withResolvedFirstImage", () => {
    afterEach(() => {
        unzip.mockReset();
    });

    it("keeps a packed cover alive for the callback and removes its extract afterward", async () => {
        const fixtureRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "yomikiru-content-source-test-"));
        const archive = path.join(fixtureRoot, "series.cbz");
        await fsp.writeFile(archive, "archive fixture");
        unzip.mockImplementation(
            (_source: string, destination: string, done: (error?: Error | null) => void) => {
                void fsp
                    .mkdir(destination, { recursive: true })
                    .then(() => fsp.writeFile(path.join(destination, "001.jpg"), "image fixture"))
                    .then(() => done(null), done);
            },
        );
        let extractedSource = "";

        try {
            const result = await withResolvedFirstImage(archive, async (source) => {
                extractedSource = source;
                await expect(fsp.access(source)).resolves.toBeUndefined();
                return "materialized";
            });

            expect(result).toBe("materialized");
            await expect(fsp.access(extractedSource)).rejects.toThrow();
        } finally {
            await fsp.rm(fixtureRoot, { recursive: true, force: true });
        }
    });
});
