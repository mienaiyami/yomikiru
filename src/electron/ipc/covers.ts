import fs from "node:fs";
import type { Readable } from "node:stream";
import type { CoverChannels, CoverOpResult } from "@common/types/ipc";
import { withEpubArchivePackage, withResolvedMangaLibraryCover } from "@electron/util/contentSource";
import {
    coverFilePathForLibraryId,
    getCoversDirectoryAbsolute,
    materializeCoverFromSourcePath,
    materializeCoverFromStream,
} from "@electron/util/coverMaterialize";
import { createMainLogger } from "@electron/util/logger";
import { ipcMain } from "electron";

const logger = createMainLogger("ipc/covers");

/** Process-wide limit for renderer-owned PDF canvas work that writes the shared cover cache. */
const PDF_COVER_RENDER_CONCURRENCY = 2;

/** A renderer's queued or active request to render one PDF cover page. */
type PdfCoverRenderJob = {
    libraryId: number;
    webContentsId: number;
    resolve: (acquired: boolean) => void;
};

/** Active PDF render jobs keyed by library id so only one renderer writes a cover at a time. */
const activePdfCoverRenderJobs = new Map<number, PdfCoverRenderJob>();

/** Waiting PDF jobs that main grants as shared canvas capacity becomes available. */
const queuedPdfCoverRenderJobs: PdfCoverRenderJob[] = [];

/** Grants queued jobs up to the process-wide PDF canvas limit. */
const grantQueuedPdfCoverRenders = (): void => {
    while (activePdfCoverRenderJobs.size < PDF_COVER_RENDER_CONCURRENCY && queuedPdfCoverRenderJobs.length > 0) {
        const job = queuedPdfCoverRenderJobs.shift();
        if (!job) return;
        activePdfCoverRenderJobs.set(job.libraryId, job);
        job.resolve(true);
    }
};

/** Removes a queued or active job when its renderer closes before releasing the PDF canvas slot. */
const cancelPdfCoverRender = (libraryId: number, webContentsId: number): void => {
    const active = activePdfCoverRenderJobs.get(libraryId);
    if (active?.webContentsId === webContentsId) {
        activePdfCoverRenderJobs.delete(libraryId);
        grantQueuedPdfCoverRenders();
        return;
    }

    const queuedIndex = queuedPdfCoverRenderJobs.findIndex(
        (job) => job.libraryId === libraryId && job.webContentsId === webContentsId,
    );
    if (queuedIndex < 0) return;
    const [queued] = queuedPdfCoverRenderJobs.splice(queuedIndex, 1);
    queued?.resolve(false);
};

/** Queues a renderer for a PDF canvas slot, rejecting duplicate work for the same library id. */
const acquirePdfCoverRender = (libraryId: number, webContentsId: number): Promise<boolean> => {
    if (
        activePdfCoverRenderJobs.has(libraryId) ||
        queuedPdfCoverRenderJobs.some((job) => job.libraryId === libraryId)
    ) {
        return Promise.resolve(false);
    }
    return new Promise((resolve) => {
        queuedPdfCoverRenderJobs.push({ libraryId, webContentsId, resolve });
        grantQueuedPdfCoverRenders();
    });
};

/** Releases an active PDF canvas slot only when requested by the renderer that owns it. */
const releasePdfCoverRender = (libraryId: number, webContentsId: number): void => {
    const active = activePdfCoverRenderJobs.get(libraryId);
    if (!active || active.webContentsId !== webContentsId) return;
    activePdfCoverRenderJobs.delete(libraryId);
    grantQueuedPdfCoverRenders();
};

/**
 * Wraps a cover op: unexpected exceptions become `{ ok: false, message }` (logged as `error`),
 * while handler-reported `{ ok: false }` results are logged as `warn` but returned verbatim.
 */
const runCoverOp = async (label: string, work: () => Promise<CoverOpResult>): Promise<CoverOpResult> => {
    try {
        const result = await work();
        if (!result.ok) logger.warn(`${label} failed: ${result.message}`);
        return result;
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error(`${label} threw`, msg);
        return { ok: false, message: msg };
    }
};

/** Resolves a library item's cover source and materializes archive entries without temp extraction. */
const materializeFromLibraryPath = async (
    request: CoverChannels["covers:materializeFromLibraryPath"]["request"],
): Promise<CoverOpResult> => {
    const consumeSource = (source: string | Readable): Promise<CoverOpResult> =>
        typeof source === "string"
            ? materializeCoverFromSourcePath(request.libraryId, source)
            : materializeCoverFromStream(request.libraryId, source);
    const result =
        request.itemType === "book"
            ? await withEpubArchivePackage(request.link, async (pkg) => {
                  const cover = await pkg.openCover();
                  return cover ? consumeSource(cover) : undefined;
              })
            : await withResolvedMangaLibraryCover(request.link, consumeSource);
    return result ?? { ok: false, message: "cover source not found" };
};

/**
 * Registers IPC handlers for cover cache operations (sharp on main).
 */
export const registerCoverHandlers = (): void => {
    ipcMain.handle("covers:materialize", (_, request: CoverChannels["covers:materialize"]["request"]) =>
        runCoverOp(`covers:materialize id=${request.libraryId}`, () =>
            materializeCoverFromSourcePath(request.libraryId, request.sourceAbsolutePath),
        ),
    );

    ipcMain.handle(
        "covers:materializeFromLibraryPath",
        (_, request: CoverChannels["covers:materializeFromLibraryPath"]["request"]) =>
            runCoverOp(`covers:materializeFromLibraryPath id=${request.libraryId}`, () =>
                materializeFromLibraryPath(request),
            ),
    );

    ipcMain.handle(
        "covers:acquirePdfRender",
        async (event, request: CoverChannels["covers:acquirePdfRender"]["request"]) => {
            const webContentsId = event.sender.id;
            event.sender.once("destroyed", () => cancelPdfCoverRender(request.libraryId, webContentsId));
            return acquirePdfCoverRender(request.libraryId, webContentsId);
        },
    );

    ipcMain.handle(
        "covers:releasePdfRender",
        (event, request: CoverChannels["covers:releasePdfRender"]["request"]) => {
            releasePdfCoverRender(request.libraryId, event.sender.id);
        },
    );

    ipcMain.handle(
        "covers:deleteForLibraryId",
        (_, request: CoverChannels["covers:deleteForLibraryId"]["request"]) =>
            runCoverOp(`covers:deleteForLibraryId id=${request.libraryId}`, async () => {
                const abs = coverFilePathForLibraryId(request.libraryId);
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
                return { ok: true };
            }),
    );

    ipcMain.handle("covers:clearCache", () =>
        runCoverOp("covers:clearCache", async () => {
            const dir = getCoversDirectoryAbsolute();
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
            fs.mkdirSync(dir, { recursive: true });
            logger.log("covers:clearCache removed userData/covers and recreated empty directory");
            return { ok: true };
        }),
    );
};
