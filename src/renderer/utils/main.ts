import { app, dialog, getCurrentWindow, clipboard, nativeImage, shell } from "@electron/remote";
import { ipcRenderer, webFrame } from "electron";
import path from "path";
import fs from "fs";
import * as chokidar from "chokidar";

window.electron = {
    app,
    dialog,
    shell,
    // todo remove ipcRenderer in favor of typed ./ipc
    ipcRenderer,
    getCurrentWindow,
    clipboard,
    nativeImage,
    webFrame,
};

// todo: remove these later
window.path = path;
window.fs = fs;
window.chokidar = chokidar;

import log from "electron-log";
log.transports.file.resolvePath = () => path.join(app.getPath("userData"), "logs/renderer.log");

import AniList from "./anilist";
import { SHORTCUT_COMMAND_MAP, keyFormatter } from "./keybindings";
import { colorUtils } from "./color";
import { dialogUtils } from "./dialog";
import { formatUtils, makeFileSafe } from "./file";
import { themeProps } from "./theme";

window.themeProps = themeProps;

window.app.formats = formatUtils;

window.SHORTCUT_COMMANDS = SHORTCUT_COMMAND_MAP;
window.keyFormatter = keyFormatter;
window.logger = log;

window.makeFileSafe = makeFileSafe;

window.getCSSPath = (el) => {
    if (!(el instanceof Element)) return "";
    const path = [] as string[];
    let elem = el;
    while (elem.nodeType === Node.ELEMENT_NODE) {
        let selector = elem.nodeName.toLowerCase();
        if (elem.id) {
            selector += "#" + elem.id.trim().replaceAll(".", "\\.");
            path.unshift(selector);
            break;
        } else {
            let sib = elem,
                nth = 1;
            while (sib.previousElementSibling) {
                sib = sib.previousElementSibling;
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth !== 1) selector += ":nth-of-type(" + nth + ")";
        }
        path.unshift(selector);
        elem = elem.parentNode as Element;
    }
    return path.join(" > ");
};

window.app.betterSortOrder = Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;
window.app.deleteDirOnClose = "";
window.app.currentPageNumber = 1;
window.app.epubHistorySaveData = null;

// todo: remove dependency on window.app.linkInReader
window.app.linkInReader = {
    type: "",
    link: "",
    page: 1,
    chapter: "",
};

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
window.contextMenu = {
    /**
     * using this to fake right click event on element, for easier management
     */
    fakeEvent(elem, focusBackElem) {
        if (elem instanceof HTMLElement)
            return new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: false,
                view: window,
                button: 2,
                buttons: 0,
                clientX: elem.getBoundingClientRect().width + elem.getBoundingClientRect().x - 10,
                clientY: elem.getBoundingClientRect().height / 2 + elem.getBoundingClientRect().y,
                relatedTarget: focusBackElem,
            });
        else
            return new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: false,
                view: window,
                button: 2,
                buttons: 0,
                clientX: elem.posX,
                clientY: elem.posY,
                relatedTarget: focusBackElem,
            });
    },
};

window.app.randomString = (length: number) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i <= length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

window.color = colorUtils;
window.dialog = dialogUtils;
window.al = new AniList();
