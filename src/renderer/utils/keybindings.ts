export const SHORTCUT_COMMAND_MAP = [
    {
        command: "navToPage" as const,
        name: "Search Page Number",
        defaultKeys: ["f"],
    },
    {
        command: "toggleZenMode" as const,
        name: "Toggle Zen Mode / Full Screen",
        defaultKeys: ["backquote"],
    },
    {
        command: "largeScroll" as const,
        name: "Scroll Down (Scroll B)",
        defaultKeys: ["space"],
    },
    {
        command: "largeScrollReverse" as const,
        name: "Scroll Up (Scroll B)",
        defaultKeys: ["shift+space"],
    },
    {
        command: "scrollDown" as const,
        name: "Scroll Down (Scroll A)",
        defaultKeys: ["s", "down"],
    },
    {
        command: "scrollUp" as const,
        name: "Scroll Up (Scroll A)",
        defaultKeys: ["w", "up"],
    },
    {
        command: "prevPage" as const,
        name: "Previous Page",
        defaultKeys: ["a", "left"],
    },
    {
        command: "nextPage" as const,
        name: "Next Page",
        defaultKeys: ["d", "right"],
    },
    {
        command: "nextChapter" as const,
        name: "Next Chapter",
        defaultKeys: ["bracketright"],
    },
    {
        command: "prevChapter" as const,
        name: "Previous Chapter",
        defaultKeys: ["bracketleft"],
    },
    {
        command: "bookmark" as const,
        name: "Bookmark",
        defaultKeys: ["b"],
    },
    {
        command: "sizePlus" as const,
        name: "Increase Reader size",
        defaultKeys: ["equal", "numpad_plus"],
    },
    {
        command: "sizeMinus" as const,
        name: "Decrease Reader size",
        defaultKeys: ["minus", "numpad_minus"],
    },
    {
        command: "readerSettings" as const,
        name: "Open/Close Reader Settings",
        defaultKeys: ["q"],
    },
    {
        command: "showHidePageNumberInZen" as const,
        name: "Show/Hide Page number in Zen Mode",
        defaultKeys: ["p"],
    },
    {
        command: "cycleFitOptions" as const,
        name: "Cycle through fit options",
        defaultKeys: ["v"],
    },
    {
        command: "selectReaderMode0" as const,
        name: "Reading mode - Vertical Scroll",
        defaultKeys: ["9"],
    },
    {
        command: "selectReaderMode1" as const,
        name: "Reading mode - Left to Right",
        defaultKeys: ["0"],
    },
    {
        command: "selectReaderMode2" as const,
        name: "Reading mode - Right to Left",
        defaultKeys: [],
    },
    {
        command: "selectPagePerRow1" as const,
        name: "Select Page Per Row - 1",
        defaultKeys: ["1"],
    },
    {
        command: "selectPagePerRow2" as const,
        name: "Select Page Per Row - 2",
        defaultKeys: ["2"],
    },
    {
        command: "selectPagePerRow2odd" as const,
        name: "Select Page Per Row - 2odd",
        defaultKeys: ["3"],
    },
    {
        command: "fontSizePlus" as const,
        name: "Increase font size (epub)",
        defaultKeys: ["shift+equal"],
    },
    {
        command: "fontSizeMinus" as const,
        name: "Decrease font size (epub)",
        defaultKeys: ["shift+minus"],
    },
    {
        command: "navToHome" as const,
        name: "Home",
        defaultKeys: ["h"],
    },
    {
        command: "dirUp" as const,
        name: "Directory Up",
        defaultKeys: ["alt+up"],
    },
    {
        command: "contextMenu" as const,
        name: "Context Menu",
        defaultKeys: ["ctrl+slash", "shift+f10", "menu"],
    },
    {
        command: "readerSize_50" as const,
        name: "Reader Size : 50%",
        defaultKeys: ["ctrl+1"],
    },
    {
        command: "readerSize_100" as const,
        name: "Reader Size : 100%",
        defaultKeys: ["ctrl+2"],
    },
    {
        command: "readerSize_150" as const,
        name: "Reader Size : 150%",
        defaultKeys: ["ctrl+3"],
    },
    {
        command: "readerSize_200" as const,
        name: "Reader Size : 200%",
        defaultKeys: ["ctrl+4"],
    },
    {
        command: "readerSize_250" as const,
        name: "Reader Size : 250%",
        defaultKeys: ["ctrl+5"],
    },
    {
        command: "openSettings" as const,
        name: "Settings",
        defaultKeys: ["ctrl+i"],
    },
    {
        command: "uiSizeReset" as const,
        name: "Reset UI Size",
        defaultKeys: ["ctrl+0"],
    },
    {
        command: "uiSizeDown" as const,
        name: "Decrease UI Size",
        defaultKeys: ["ctrl+minus"],
    },
    {
        command: "uiSizeUp" as const,
        name: "Increase UI Size",
        defaultKeys: ["ctrl+equal"],
    },
    {
        command: "listDown" as const,
        name: "List Down",
        defaultKeys: ["down", "ctrl+j"],
    },
    {
        command: "listUp" as const,
        name: "List Up",
        defaultKeys: ["up", "ctrl+k"],
    },
    {
        command: "listSelect" as const,
        name: "List Select",
        defaultKeys: ["enter"],
    },
];
Object.freeze(SHORTCUT_COMMAND_MAP);

/**
 * Format key event to string (e.g. "ctrl+shift+a", "ctrl+shift+numpad_plus")
 * @param e key event
 * @param limited Do not include some keys (e.g. "Control", "Shift", "Alt", "Tab", "Escape")
 * @returns formatted key string
 */
export const keyFormatter = (e: KeyboardEvent | React.KeyboardEvent, limited = true): string => {
    if (limited && ["Control", "Shift", "Alt", "Tab", "Escape"].includes(e.key)) return "";

    // using lowercase because more readable
    let keyStr = "";
    if (e.ctrlKey) keyStr += "ctrl+";
    if (e.shiftKey) keyStr += "shift+";
    if (e.altKey) keyStr += "alt+";

    switch (true) {
        case /^Key[A-Z]$/.test(e.code):
            keyStr += e.code.slice(3).toLowerCase();
            break;
        case /^Digit[0-9]$/.test(e.code):
            keyStr += e.code.slice(5);
            break;
        case /^Numpad[0-9]$/.test(e.code):
            keyStr += "numpad_" + e.code.slice(6);
            break;
        case e.code === "NumpadAdd":
            keyStr += "numpad_plus";
            break;
        case e.code === "NumpadSubtract":
            keyStr += "numpad_minus";
            break;
        case e.code === "NumpadMultiply":
            keyStr += "numpad_multiply";
            break;
        case e.code === "NumpadDivide":
            keyStr += "numpad_divide";
            break;
        case e.code === "NumpadDecimal":
            keyStr += "numpad_period";
            break;
        case e.code.startsWith("Arrow"):
            keyStr += e.code.slice(5).toLowerCase();
            break;
        case e.code === "PageDown":
            keyStr += "pagedown";
            break;
        case e.code === "PageUp":
            keyStr += "pageup";
            break;
        case e.code === "ContextMenu":
            keyStr += "menu";
            break;
        default:
            keyStr += e.code.toLowerCase();
            break;
    }
    return keyStr;
};
