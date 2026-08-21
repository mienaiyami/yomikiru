import path from "node:path";
import { createTestFs, onInvoke } from "@test/mocks/preload";
import { describe, expect, it, vi } from "vitest";
import { DirectoryValidatorService } from "./directoryValidator";

type MakeServiceOpts = {
    onProgress?: ReturnType<typeof vi.fn>;
    keepExtractedFiles?: boolean;
};

/**
 * Builds a {@link DirectoryValidatorService} with injectable `fs` and a silent logger.
 */
const makeService = (fsOverrides: Parameters<typeof createTestFs>[0] = {}, opts: MakeServiceOpts = {}) => {
    const logger = {
        log: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        verbose: vi.fn(),
        debug: vi.fn(),
    };
    const onProgress = opts.onProgress ?? vi.fn();
    return {
        onProgress,
        service: new DirectoryValidatorService({
            fs: createTestFs(fsOverrides),
            path: window.path,
            logger: logger as never,
            electron: window.electron,
            app: window.app,
            onProgress,
            appSettings: { keepExtractedFiles: opts.keepExtractedFiles ?? false, pdfScale: 1.5 },
        }),
    };
};

describe("DirectoryValidatorService", () => {
    it("cancel is not implemented yet", () => {
        expect(() => makeService().service.cancel()).toThrow(/Not implemented/);
    });

    it("rejects empty directories without showing dialogs when errorOnInvalid is false", async () => {
        const dir = path.join("testdata", "empty");
        const { service } = makeService({
            readdir: async () => [],
            stat: async () => ({ mtimeMs: 1 }),
        });
        await expect(
            service.validateDirectory(dir, {
                useCache: false,
                errorOnInvalid: false,
                sendImages: true,
            }),
        ).resolves.toMatchObject({ isValid: false, error: "Directory is empty" });
    });

    it("returns sorted image paths when sendImages is true", async () => {
        const dir = path.join("testdata", "manga", "ch1");
        const { service } = makeService({
            readdir: async () => ["b.png", "a.png", "notes.txt"],
            stat: async () => ({ mtimeMs: 2 }),
        });
        const result = await service.validateDirectory(dir, {
            useCache: false,
            errorOnInvalid: false,
            sendImages: true,
        });
        expect(result.isValid).toBe(true);
        expect(result.images).toEqual([path.join(dir, "a.png"), path.join(dir, "b.png")]);
        expect(result.imageCount).toBe(2);
    });

    it("firstImageOnly returns a single path but full imageCount", async () => {
        const dir = path.join("testdata", "manga", "ch1");
        const { service } = makeService({
            readdir: async () => ["02.jpg", "01.jpg"],
            stat: async () => ({ mtimeMs: 3 }),
        });
        const result = await service.validateDirectory(dir, {
            useCache: false,
            errorOnInvalid: false,
            firstImageOnly: true,
            sendImages: true,
        });
        expect(result).toEqual({
            isValid: true,
            images: [path.join(dir, "01.jpg")],
            imageCount: 2,
        });
    });

    it("walks one subdirectory when the root has no images", async () => {
        const root = path.join("testdata", "manga", "series");
        const chapter = path.join(root, "ch1");
        const { service } = makeService({
            readdir: async (dir) => {
                if (dir === root) return ["ch1", "readme.txt"];
                if (dir === chapter) return ["page.png"];
                return [];
            },
            stat: async () => ({ mtimeMs: 4 }),
            isDir: (dir) => dir === chapter,
        });
        const result = await service.validateDirectory(root, {
            useCache: false,
            errorOnInvalid: false,
            sendImages: true,
            maxSubdirectoryDepth: 1,
        });
        expect(result.isValid).toBe(true);
        expect(result.images).toEqual([path.join(chapter, "page.png")]);
    });

    it("rejects folders with no supported images when depth is exhausted", async () => {
        const dir = path.join("testdata", "manga", "text-only");
        const { service } = makeService({
            readdir: async () => ["notes.txt"],
            stat: async () => ({ mtimeMs: 5 }),
            isDir: () => false,
        });
        await expect(
            service.validateDirectory(dir, {
                useCache: false,
                errorOnInvalid: false,
                maxSubdirectoryDepth: 0,
            }),
        ).resolves.toMatchObject({ isValid: false, error: "No supported images found" });
    });

    it("does not emit extract progress for packed files when showLoading is false", async () => {
        const link = path.join("testdata", "series.cbz");
        const tempExtractPath = path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-images-${path.basename(link)}`,
        );
        onInvoke("fs:unzip", async (req) => ({
            ok: true as const,
            source: req.source,
            destination: req.destination,
        }));
        const { service, onProgress } = makeService({
            readdir: async (dir) => (dir === tempExtractPath ? ["01.png"] : []),
            stat: async () => ({ mtimeMs: 6 }),
            existsSync: () => false,
        });
        await service.validateDirectory(link, {
            useCache: false,
            errorOnInvalid: false,
            showLoading: false,
            sendImages: true,
        });
        expect(onProgress).not.toHaveBeenCalled();
    });

    it("emits extract progress for packed files when showLoading is true", async () => {
        const link = path.join("testdata", "series.cbz");
        const tempExtractPath = path.join(
            window.electron.app.getPath("temp"),
            `yomikiru-temp-images-${path.basename(link)}`,
        );
        onInvoke("fs:unzip", async (req) => ({
            ok: true as const,
            source: req.source,
            destination: req.destination,
        }));
        const { service, onProgress } = makeService({
            readdir: async (dir) => (dir === tempExtractPath ? ["01.png"] : []),
            stat: async () => ({ mtimeMs: 7 }),
            existsSync: () => false,
        });
        await service.validateDirectory(link, {
            useCache: false,
            errorOnInvalid: false,
            showLoading: true,
            sendImages: true,
        });
        expect(onProgress).toHaveBeenCalled();
        expect(onProgress.mock.calls.some((call) => String(call[0]?.message ?? "").includes("EXTRACTING"))).toBe(
            true,
        );
    });
});
