import { formatUtils } from "./file";

/**
 * CSS path from `element` up to (not including) `chapterRoot`, stopping at the first id.
 * Pass `chapterRoot` null for a document-wide path ({@link getCSSPath}).
 * Empty when `element` is `chapterRoot` or not a descendant.
 *
 * @param element - node to describe
 * @param chapterRoot - stop before this ancestor; null walks to the document
 */
export const getCSSPathWithin = (element: Element, chapterRoot: Element | null): string => {
    if (
        !(element instanceof Element) ||
        (chapterRoot && (element === chapterRoot || !chapterRoot.contains(element)))
    )
        return "";
    const path: string[] = [];
    let elem = element;
    while (elem.nodeType === Node.ELEMENT_NODE && elem !== chapterRoot) {
        let selector = elem.nodeName.toLowerCase();
        if (elem.id) {
            path.unshift(`${selector}#${elem.id.trim().replaceAll(".", "\\.")}`);
            break;
        }
        let sib = elem;
        let nth = 1;
        while (sib.previousElementSibling) {
            sib = sib.previousElementSibling;
            if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        if (nth !== 1) selector += `:nth-of-type(${nth})`;
        path.unshift(selector);
        const parent = elem.parentNode;
        if (!(parent instanceof Element)) break;
        elem = parent;
    }
    return path.join(" > ");
};

/**
 * Document-wide CSS path for `element`, stopping at the first id.
 * Prefer {@link getCSSPathWithin} for EPUB locators so the path stays inside one chapter root.
 *
 * @param element - node to describe
 */
export const getCSSPath = (element: Element): string => getCSSPathWithin(element, null);

/**
 * `#app` when the shell is mounted, otherwise `document.body` (unit tests).
 * Portal host for overlays that must escape CSS containment without changing Modal.
 */
export const appRootElement = (): HTMLElement => document.getElementById("app") ?? document.body;

window.app.betterSortOrder = Intl.Collator(undefined, { numeric: true, sensitivity: "base" }).compare;
window.app.deleteDirOnClose = "";
window.sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Finds a cover image in the given manga directory
 * @param dirPath The path to the manga directory
 * @returns The path to the cover image if found, empty string otherwise
 */
export const findCover = (dirPath: string): string => {
    let realCover = "";
    const possibleCoverNames = formatUtils.image.list.map((e) => `cover${e}`).concat("cover");
    try {
        for (const file of possibleCoverNames) {
            const filePath = window.path.join(dirPath, file);
            if (window.fs.isFile(filePath)) {
                realCover = filePath;
                break;
            }
        }
    } catch (e) {
        console.error(e);
    }
    return realCover;
};

//@ts-expect-error
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

/**
 * Scrolls `child` inside `container` without moving ancestor scrollers.
 * `Element.scrollIntoView` also shifts outer overflow boxes (gallery details hero).
 *
 * @param block `"center"` places the child in the middle of the container; `"nearest"`
 * only moves if the child is clipped.
 */
export const scrollChildInContainer = (
    container: HTMLElement,
    child: HTMLElement,
    block: "center" | "nearest" = "center",
): void => {
    const cRect = container.getBoundingClientRect();
    const eRect = child.getBoundingClientRect();
    if (block === "nearest") {
        if (eRect.top >= cRect.top && eRect.bottom <= cRect.bottom) return;
        if (eRect.top < cRect.top) {
            container.scrollTop += eRect.top - cRect.top;
            return;
        }
        container.scrollTop += eRect.bottom - cRect.bottom;
        return;
    }
    container.scrollTop += eRect.top - cRect.top - (cRect.height - eRect.height) / 2;
};

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns a debounced function that delays invoking `callback` until `waitMs` has elapsed.
 */
export const debounce = <T extends unknown[]>(
    callback: (...args: T) => void,
    waitMs: number,
): ((...args: T) => void) => {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    return (...args: T) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
            callback(...args);
        }, waitMs);
    };
};
