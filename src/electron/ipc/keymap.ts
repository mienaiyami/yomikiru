import type { KeymapSnapshot, NativeKeymapAction } from "@common/keybindings";
import { firstBindingMenuAccelerator, keymapPlatformFromNode, NATIVE_KEYMAP_ACTIONS } from "@common/keybindings";
import { rebuildApplicationMenuNow } from "@electron/i18n/ipc";
import { ipc } from "@electron/ipc/utils";
import {
    getKeymapFileStore,
    initializeKeymapFileStore,
    tryGetKeymapFileStore,
} from "@electron/util/keymapFileStore";
import { createMainLogger } from "@electron/util/logger";
import { WindowManager } from "@electron/util/window";
import { app, BrowserWindow, shell } from "electron";

const log = createMainLogger("ipc/keymap");

const HELP_URL = "https://github.com/mienaiyami/yomikiru";

const isNativeKeymapAction = (action: string): action is NativeKeymapAction =>
    (NATIVE_KEYMAP_ACTIONS as readonly string[]).includes(action);

/**
 * Electron `accelerator` for a native menu item from the effective keymap.
 * Empty before the store loads or when the command is unbound. Callers must
 * keep `registerAccelerator: false` so this is display-only.
 */
export const nativeMenuAccelerator = (commandId: NativeKeymapAction): string => {
    const store = tryGetKeymapFileStore();
    if (!store) return "";
    const snapshot = store.snapshot();
    return firstBindingMenuAccelerator(snapshot.document, commandId, snapshot.platform);
};

/**
 * Runs an allowlisted native action for the originating window.
 *
 * @param action Catalog native command id
 * @param originWindow BrowserWindow that requested the action
 */
export const runNativeKeymapAction = (action: NativeKeymapAction, originWindow: BrowserWindow | null): void => {
    switch (action) {
        case "newWindow":
            WindowManager.createWindow();
            return;
        case "closeWindow":
            originWindow?.close();
            return;
        case "reload":
            originWindow?.reload();
            return;
        case "forceReload":
            originWindow?.webContents.reloadIgnoringCache();
            return;
        case "toggleDevTools":
            originWindow?.webContents.toggleDevTools();
            return;
        case "help":
            void shell.openExternal(HELP_URL);
            return;
    }
};

/**
 * Pushes a snapshot to every live window. Renderers skip the origin echo and
 * apply only when Sync Settings is on.
 *
 * @param originWindowId BrowserWindow id that submitted the edit, or null
 */
const broadcastKeymapChanged = (snapshot: KeymapSnapshot, originWindowId: number | null): void => {
    for (const window of WindowManager.getAllWindows()) {
        if (window.isDestroyed()) continue;
        ipc.send(window.webContents, "keymap:changed", { snapshot, originWindowId });
    }
};

/**
 * Loads the process keymap owner then registers get/edit IPC.
 * Must run before the first renderer hydrates.
 */
export const registerKeymapHandlers = async (): Promise<void> => {
    await initializeKeymapFileStore(app.getPath("userData"), keymapPlatformFromNode(process.platform));
    ipc.handle("keymap:get", () => getKeymapFileStore().snapshot());
    ipc.handle("keymap:edit", async (event, operation) => {
        const originWindowId = BrowserWindow.fromWebContents(event.sender)?.id ?? null;
        const result = await getKeymapFileStore().applyEdit(operation);
        if (result.ok) {
            broadcastKeymapChanged(result.snapshot, originWindowId);
            rebuildApplicationMenuNow();
        }
        return result;
    });
    ipc.handle("keymap:nativeAction", (event, { action }) => {
        if (!isNativeKeymapAction(action)) {
            log.error("keymap:nativeAction rejected unknown action", { action });
            return;
        }
        const originWindow = BrowserWindow.fromWebContents(event.sender);
        runNativeKeymapAction(action, originWindow);
    });
    log.log("keymap IPC ready");
};
