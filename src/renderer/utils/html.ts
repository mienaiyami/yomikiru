/** Element names kept when rendering About HTML from overlays or tracker cache. */
export const DETAILS_ABOUT_HTML_TAGS: ReadonlySet<string> = new Set(["br", "i", "em", "b", "strong", "p"]);

const escapeText = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Serializes one DOM node to allowlisted HTML. Script and style are dropped;
 * other disallowed elements unwrap so their text remains.
 */
const serializeAllowed = (node: Node, allowed: ReadonlySet<string>): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeText(node.textContent ?? "");
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    /* drop script/style entirely so unwrapping cannot keep their text */
    if (tag === "script" || tag === "style") return "";
    if (tag === "br") return "<br>";
    const inner = [...el.childNodes].map((child) => serializeAllowed(child, allowed)).join("");
    if (allowed.has(tag) && tag !== "br") return `<${tag}>${inner}</${tag}>`;
    return inner;
};

/**
 * Returns HTML that keeps only the given element names (no attributes).
 * Disallowed elements are unwrapped; their text remains. Used for About in gallery details.
 *
 * @param allowed Tag names that may appear in the result
 */
export const sanitizeHtmlAllowlist = (raw: string, allowed: ReadonlySet<string>): string => {
    const parsed = new DOMParser().parseFromString(raw, "text/html");
    return [...parsed.body.childNodes].map((child) => serializeAllowed(child, allowed)).join("");
};
