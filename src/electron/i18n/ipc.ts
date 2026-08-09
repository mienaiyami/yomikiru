import fs from "node:fs";
import path from "node:path";
import {
    BUILTIN_EN_SOURCE_ID,
    getBuiltinLocale,
    parseBuiltinSourceId,
    parsePackSourceId,
    resolveLanguageSource,
} from "@common/i18n";
import { ipc } from "@electron/ipc/utils";
import { createMainLogger } from "@electron/util/logger";
import { MainSettings } from "@electron/util/mainSettings";
import { WindowManager } from "@electron/util/window";
import { applyMainI18nState, getI18nState, toChangedPayload } from "./mainI18n";
import {
    exportPackToArchive,
    getI18nPacksRoot,
    installPackFromArchive,
    listLanguageSources,
    materializeBuiltinExportDir,
    removeInstalledPack,
} from "./packs";

const logger = createMainLogger("i18n/ipc");

type MenuRebuild = () => void;

let rebuildApplicationMenu: MenuRebuild = () => {
    /* set from main after menu template helper exists */
};

/**
 * Registers a callback that rebuilds the Electron application menu after language changes.
 */
export const setApplicationMenuRebuild = (fn: MenuRebuild): void => {
    rebuildApplicationMenu = fn;
};

const broadcastI18n = (): void => {
    const state = getI18nState();
    const payload = toChangedPayload(state);
    for (const window of WindowManager.getAllWindows()) {
        ipc.send(window.webContents, "i18n:changed", payload);
        ipc.send(window.webContents, "mainSettings:sync", MainSettings.settings);
    }
};

/**
 * Persists `languageSourceId`, reloads main i18n, rebuilds menus, and notifies renderers.
 */
export const setLanguageSource = async (sourceId: string): Promise<ReturnType<typeof getI18nState>> => {
    const sources = listLanguageSources();
    const { source, healed } = resolveLanguageSource(sourceId, sources);
    if (healed) {
        logger.warn("setLanguageSource: unknown sourceId; using builtin:en", { sourceId });
    }
    await MainSettings.updateSettings({ languageSourceId: source.id });
    const state = getI18nState();
    await applyMainI18nState(state);
    rebuildApplicationMenu();
    broadcastI18n();
    return state;
};

/**
 * Registers i18n IPC handlers. Call after {@link initMainI18n}.
 */
export const registerI18nHandlers = (): void => {
    ipc.handle("i18n:getState", () => getI18nState());
    ipc.handle("i18n:listSources", () => listLanguageSources());
    ipc.handle("i18n:setSource", async (_e, { sourceId }) => setLanguageSource(sourceId));

    ipc.handle("i18n:installPack", async (_e, { archivePath }) => {
        const result = await installPackFromArchive(archivePath);
        if (!result.ok) return result;
        /* stay on current source; user selects the new pack from the dropdown */
        broadcastI18n();
        return result;
    });

    ipc.handle("i18n:removePack", async (_e, { packId }) => {
        const current = MainSettings.settings.languageSourceId;
        const currentPackId = parsePackSourceId(current);
        const result = removeInstalledPack(packId);
        if (!result.ok) return result;
        if (currentPackId === packId) {
            await setLanguageSource(BUILTIN_EN_SOURCE_ID);
        } else {
            broadcastI18n();
        }
        return result;
    });

    ipc.handle("i18n:exportPack", async (_e, { sourceId, destinationPath }) => {
        const builtinLocale = parseBuiltinSourceId(sourceId);
        if (builtinLocale) {
            const def = getBuiltinLocale(builtinLocale);
            if (!def) {
                return { ok: false as const, message: "unknown source" };
            }
            const tempDir = materializeBuiltinExportDir({
                locale: def.locale,
                name: def.name,
                resources: def.resources,
            });
            try {
                return await exportPackToArchive(tempDir, destinationPath);
            } finally {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
        }
        const packId = parsePackSourceId(sourceId);
        if (!packId) {
            return { ok: false as const, message: "unknown source" };
        }
        const packDir = path.join(getI18nPacksRoot(), packId);
        return exportPackToArchive(packDir, destinationPath);
    });

    logger.info("i18n IPC handlers registered");
};
