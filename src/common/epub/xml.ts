import { XMLParser, XMLValidator } from "fast-xml-parser";

/** Ordered XML parser used for EPUB package documents in both app processes. */
const EPUB_XML_PARSER = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: "",
    textNodeName: "#text",
    trimValues: false,
    parseTagValue: false,
    parseAttributeValue: false,
    removeNSPrefix: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    htmlEntities: true,
});

/** One element: local name, attributes, descendant text, and child elements. */
export type XmlNode = {
    name: string;
    attrs: Record<string, string>;
    text: string;
    children: XmlNode[];
};

type OrderedXmlEntry = Record<string, unknown> & {
    ":@"?: Record<string, unknown>;
};

/**
 * Local name of a qualified XML name (`dc:title` -> `title`).
 */
export const xmlLocalName = (qname: string): string => {
    const i = qname.indexOf(":");
    return (i >= 0 ? qname.slice(i + 1) : qname).toLowerCase();
};

const elementKey = (entry: OrderedXmlEntry): string | undefined =>
    Object.keys(entry).find((key) => key !== ":@" && key !== "#text");

/** Converts fast-xml-parser's ordered representation to the small tree consumed by the EPUB parser. */
const toXmlNode = (entry: OrderedXmlEntry): XmlNode => {
    const key = elementKey(entry);
    if (!key) throw new Error("parseXml: element name missing");

    const rawAttrs = entry[":@"] ?? {};
    const attrs = Object.fromEntries(
        Object.entries(rawAttrs).map(([name, value]) => [xmlLocalName(name), String(value ?? "")]),
    );
    const orderedChildren = Array.isArray(entry[key]) ? (entry[key] as OrderedXmlEntry[]) : [];
    const children: XmlNode[] = [];
    const textParts: string[] = [];

    for (const childEntry of orderedChildren) {
        if ("#text" in childEntry) {
            textParts.push(String(childEntry["#text"] ?? ""));
            continue;
        }
        if (!elementKey(childEntry)) continue;
        const child = toXmlNode(childEntry);
        children.push(child);
        textParts.push(child.text);
    }

    return {
        name: xmlLocalName(key),
        attrs,
        text: textParts.join("").trim(),
        children,
    };
};

/**
 * Attribute value by local name, or empty string when missing.
 */
export const xmlAttr = (node: XmlNode, name: string): string => node.attrs[xmlLocalName(name)] ?? "";

/**
 * Direct child elements whose local name is `name`.
 */
export const xmlChildrenNamed = (node: XmlNode, name: string): XmlNode[] => {
    const want = xmlLocalName(name);
    return node.children.filter((child) => child.name === want);
};

/**
 * First descendant (preorder, including `node`) with local name `name`.
 */
export const xmlFind = (node: XmlNode, name: string): XmlNode | undefined => {
    const want = xmlLocalName(name);
    if (node.name === want) return node;
    for (const child of node.children) {
        const found = xmlFind(child, name);
        if (found) return found;
    }
    return undefined;
};

/**
 * All descendants (preorder, excluding `node` itself) with local name `name`.
 */
export const xmlFindAll = (node: XmlNode, name: string): XmlNode[] => {
    const want = xmlLocalName(name);
    const out: XmlNode[] = [];
    const walk = (current: XmlNode): void => {
        for (const child of current.children) {
            if (child.name === want) out.push(child);
            walk(child);
        }
    };
    walk(node);
    return out;
};

/**
 * Parses and validates XML into the namespace-agnostic tree used by EPUB package parsing.
 * Accepts DTD and HTML entities used by older and web-generated EPUB metadata and navigation files.
 *
 * @throws {Error} When the document is malformed or has no root element
 */
export const parseXml = (raw: string): XmlNode => {
    const source = raw.replace(/^\uFEFF/, "").trim();
    const validation = XMLValidator.validate(source);
    if (validation !== true) {
        throw new Error(`parseXml: ${validation.err.msg}`);
    }
    const parsed = EPUB_XML_PARSER.parse(source) as unknown;
    if (!Array.isArray(parsed)) throw new Error("parseXml: no root element");
    const root = parsed.find(
        (entry): entry is OrderedXmlEntry =>
            entry !== null && typeof entry === "object" && Boolean(elementKey(entry)),
    );
    if (!root) throw new Error("parseXml: no root element");
    return toXmlNode(root);
};
