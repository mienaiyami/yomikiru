import type { NativeKeymapAction } from "@common/keybindings";
import { useAppDispatch } from "@store/hooks";
import { toggleSettingsOpen } from "@store/ui";
import { useCommandOwner } from "./useCommandOwner";

const afterUiScale = (): void => {
    if (process.platform === "win32") {
        window.electron.currentWindow.setTitleBarOverlay()({
            height: Math.floor(40 * window.electron.webFrame.getZoomFactor()),
        });
    }
    const windowBtnCont = document.querySelector(".windowBtnCont");
    if (windowBtnCont instanceof HTMLElement) {
        windowBtnCont.style.right = `${140 * (1 / window.electron.webFrame.getZoomFactor())}px`;
    }
};

const invokeNative = (action: NativeKeymapAction): void => {
    void window.electron.invoke("keymap:nativeAction", { action });
};

type UseAppCommandOwnerArgs = {
    isReaderOpen: boolean;
    closeReader: () => void | Promise<void>;
};

/**
 * App-shell commands for this window (home/settings/zoom/native). Modal overlays
 * still block home-only commands via runtime eligibility.
 */
export const useAppCommandOwner = ({ isReaderOpen, closeReader }: UseAppCommandOwnerArgs): void => {
    const dispatch = useAppDispatch();

    useCommandOwner({
        ownerId: "app",
        contextKinds: ["app"],
        visible: true,
        handlers: {
            navToHome: () => {
                if (window.electron.currentWindow.isFullScreen()) {
                    window.electron.currentWindow.setFullScreen(false);
                }
                if (isReaderOpen) {
                    void closeReader();
                    return;
                }
                window.location.reload();
            },
            openSettings: () => {
                dispatch(toggleSettingsOpen());
            },
            uiSizeReset: () => {
                window.electron.webFrame.setZoomFactor(1);
                afterUiScale();
            },
            uiSizeDown: () => {
                window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() - 0.1);
                afterUiScale();
            },
            uiSizeUp: () => {
                window.electron.webFrame.setZoomFactor(window.electron.webFrame.getZoomFactor() + 0.1);
                afterUiScale();
            },
            newWindow: () => invokeNative("newWindow"),
            closeWindow: () => invokeNative("closeWindow"),
            reload: () => invokeNative("reload"),
            forceReload: () => invokeNative("forceReload"),
            toggleDevTools: () => invokeNative("toggleDevTools"),
            help: () => invokeNative("help"),
        },
    });
};
