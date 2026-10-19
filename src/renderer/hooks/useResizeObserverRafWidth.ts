import { type RefObject, useLayoutEffect, useRef, useState } from "react";

/**
 * True when the element and its ancestors are in layout.
 * An ancestor hide leaves this element's own display unchanged, but its used size is 0.
 */
const isElementDisplayed = (element: Element): boolean => {
    let current: Element | null = element;
    while (current) {
        if (getComputedStyle(current).display === "none") return false;
        current = current.parentElement;
    }
    return true;
};

/**
 * Content-box width, the same box ResizeObserver reports as contentRect.
 * The border box includes padding, which column sizing does not.
 */
const contentBoxWidth = (element: HTMLElement): number => {
    const style = getComputedStyle(element);
    const paddingLeft = Number.parseFloat(style.paddingLeft);
    const paddingRight = Number.parseFloat(style.paddingRight);
    const padding =
        (Number.isNaN(paddingLeft) ? 0 : paddingLeft) + (Number.isNaN(paddingRight) ? 0 : paddingRight);
    return element.clientWidth - padding;
};

/**
 * Tracks element width via ResizeObserver, committing updates on the next animation frame
 * so layout writes are not nested inside the observer callback (avoids "ResizeObserver loop limit exceeded").
 *
 * Skips readings while the element is not displayed so the last laid-out width stays in place.
 *
 * @returns Tuple of ref to attach to the measured element and the latest rounded width in CSS pixels.
 */
export function useResizeObserverRafWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);
    const resizeRafRef = useRef<number | null>(null);

    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const commitWidth = (raw: number) => {
            setWidth(Math.round(raw));
        };

        const scheduleWidth = (raw: number) => {
            if (resizeRafRef.current != null) {
                cancelAnimationFrame(resizeRafRef.current);
            }
            resizeRafRef.current = requestAnimationFrame(() => {
                resizeRafRef.current = null;
                commitWidth(raw);
            });
        };

        /*
         * Commit a positive width before paint. Observer updates wait a frame,
         * so the first paint would otherwise use the unset width.
         */
        if (isElementDisplayed(el)) {
            const initialWidth = contentBoxWidth(el);
            if (initialWidth > 0) commitWidth(initialWidth);
        }

        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!isElementDisplayed(entry.target)) return;
            scheduleWidth(entry.contentRect.width);
        });
        ro.observe(el);

        return () => {
            if (resizeRafRef.current != null) {
                cancelAnimationFrame(resizeRafRef.current);
            }
            ro.disconnect();
        };
    }, []);

    return [ref, width];
}
