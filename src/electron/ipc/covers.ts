import fs from "node:fs";
import type { CoverChannels, CoverOpResult } from "@common/types/ipc";
import {
    coverFilePathForLibraryId,
    getCoversDirectoryAbsolute,
    materializeCoverFromSourcePath,
} from "@electron/util/coverMaterialize";
import { createMainLogger } from "@electron/util/logger";
import { ipcMain } from "electron";

const logger = createMainLogger("ipc/covers");

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
