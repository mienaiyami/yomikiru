// import log from "electron-log";
// log.transports.file.resolvePath = () =>
//     window.path.join(window.Electron.app.getPath("userData"), "logs/renderer.log");

// window.logger = log;

export const getCSSPath = (el: Element): string => {
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
window.sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

export const randomString = (length: number) => {
    let result = "";
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i <= length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
};

// /**
//  * scroll to a element
//  * @param query - element query string of position to scroll to
//  * @param behavior - `ScrollBehavior`
//  */
// export const scrollToElement = (query: string, behavior: ScrollBehavior = "smooth") => {
//     const element = document.querySelector(query);
//     if (element) {
//         element.scrollIntoView({ behavior, block: "start" });
//     }
// };
