import { colorUtils } from "./color";

export type HighlightRange = {
    startPath: string;
    startOffset: number;
    endPath: string;
    endOffset: number;
};

export type HighlightInfo = {
    id: string;
    range: HighlightRange;
    color: string;
    content: string;
};

const defaultHighlightClass = "text-highlight";

export const DEFAULT_HIGHLIGHT_COLORS = [
    "#FFEB3B",
    // "#FFC107",
    // "#FF9800",
    "#FF5722",
    "#03A9F4",
    // "#2196F3",
    "#4CAF50",
    "#8BC34A",
    "#9C27B0",
    "#E91E63",
];

export const highlightUtils = {
    /**
     * This path wont work with querySelector directly
     */
    getPathFromNode(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            const parent = node.parentElement;
            /**
             * this can also be like `div#epub-Section0001\\.xhtml p:nth-child(7)>0` which is not
             * valid css selector because of `>0`
             */
            return `${this.getElementPath(parent)}>${Array.from(parent.childNodes).indexOf(node as ChildNode)}`;
        }
        return this.getElementPath(node as HTMLElement);
    },

    getElementPath(element: Element): string {
        if (!(element instanceof Element)) return "";
        const path: string[] = [];
        let current: Element | null = element;

        while (current && current.id !== "EPubReader") {
            let selector = current.tagName.toLowerCase();
            if (current.id) {
                selector += `#${current.id.trim().replaceAll(".", "\\.")}`;
                path.unshift(selector);
                break;
            }
            const parent = current.parentElement;
            if (parent) {
                const siblings = Array.from(parent.children);
                const index = siblings.indexOf(current) + 1;
                if (siblings.length > 1) {
                    selector += `:nth-child(${index})`;
                }
            }

            path.unshift(selector);
            current = current.parentElement;
        }

        return path.join(" ");
    },

    getNodeFromPath(containerElement: HTMLElement, path: string): Node | null {
        const [elementPath, textNodeIndex] = path.split(">");
        const element = containerElement.querySelector(elementPath);
        if (!element) return null;
        if (textNodeIndex !== undefined) {
            const nodeIndex = parseInt(textNodeIndex);
            return element.childNodes[nodeIndex] || null;
        }

        return element;
    },

    highlight(container: HTMLElement, info: HighlightInfo): boolean {
        try {
            const { range, color, id } = info;
            const startNode = this.getNodeFromPath(container, range.startPath);
            const endNode = this.getNodeFromPath(container, range.endPath);
            if (!startNode || !endNode) return false;

            const range_ = document.createRange();
            range_.setStart(startNode, range.startOffset);
            range_.setEnd(endNode, range.endOffset);

            /**
             * `range_` can be full elements like `p` which will break the range into multiple nodes
             * so we need to get all nodes in range and highlight each node separately
             */
            const allNodes = this.getNodesInRange(range_);

            /**
             * highlight each node separately to preserve document structure
             */
            allNodes.forEach((node) => {
                if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) {
                    return;
                }

                const nodeRange = document.createRange();

                // determine if this is the start node, end node, or in-between
                const isStartNode = node === startNode;
                const isEndNode = node === endNode;

                nodeRange.selectNodeContents(node);
                if (isStartNode) {
                    nodeRange.setStart(node, range.startOffset);
                }
                if (isEndNode) {
                    nodeRange.setEnd(node, range.endOffset);
                }

                if (nodeRange.toString().trim()) {
                    try {
                        const span = document.createElement("span");
                        span.classList.add(defaultHighlightClass);
                        span.dataset.highlightId = id;
                        if (info.content) {
                            span.dataset.tooltip = info.content;
                        }
                        span.style.setProperty("--highlight-color", colorUtils.new(color).alpha(0.5).hexa());

                        try {
                            nodeRange.surroundContents(span);
                        } catch (_e) {
                            const fragment = nodeRange.extractContents();
                            span.appendChild(fragment);
                            nodeRange.insertNode(span);
                            console.warn("Failed to highlight text node:", _e);
                        }
                    } catch (e) {
                        console.warn("Failed to highlight text node:", e);
                    }
                }
            });

            return true;
        } catch (error) {
            console.error("Failed to highlight:", error);
            return false;
        }
    },

    /**
     * get all nodes within a range, both partial and complete
     */
    getNodesInRange(range: Range): Node[] {
        const commonAncestor = range.commonAncestorContainer;
        if (commonAncestor.nodeType === Node.TEXT_NODE) {
            return [commonAncestor];
        }

        const nodes: Node[] = [];
        const nodeIterator = document.createNodeIterator(commonAncestor, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
                if (node.nodeType !== Node.TEXT_NODE) {
                    return NodeFilter.FILTER_REJECT;
                }
                if (!node.textContent || !node.textContent.trim()) {
                    return NodeFilter.FILTER_REJECT;
                }
                const nodeRange = document.createRange();
                nodeRange.selectNodeContents(node);

                if (
                    range.compareBoundaryPoints(Range.END_TO_START, nodeRange) > 0 ||
                    range.compareBoundaryPoints(Range.START_TO_END, nodeRange) < 0
                ) {
                    return NodeFilter.FILTER_REJECT;
                }

                return NodeFilter.FILTER_ACCEPT;
            },
        });
        let node = nodeIterator.nextNode();
        while (node) {
            nodes.push(node);
            node = nodeIterator.nextNode();
        }

        return nodes;
    },

    removeHighlight(container: HTMLElement, id: string): void {
        const highlights = container.querySelectorAll(`[data-highlight-id="${id}"]`);
        highlights.forEach((highlight) => {
            const parent = highlight.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(highlight.textContent || ""), highlight);
                parent.normalize();
            }
        });
    },

    getCurrentSelection(): HighlightRange | null {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return null;

        const range = selection.getRangeAt(0);
        //! todo: currently have an issue,
        // will not work well if a "highlighted" text is made into note then the "highlighted" note is removed
        return {
            startPath: this.getPathFromNode(range.startContainer),
            startOffset: range.startOffset,
            endPath: this.getPathFromNode(range.endContainer),
            endOffset: range.endOffset,
        };
    },
};
