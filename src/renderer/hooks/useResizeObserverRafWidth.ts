import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Tracks element width via ResizeObserver, committing updates on the next animation frame
 * so layout writes are not nested inside the observer callback (avoids "ResizeObserver loop limit exceeded").
 *
 * @returns Tuple of ref to attach to the measured element and the latest rounded width in CSS pixels.
 */
export function useResizeObserverRafWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
    const ref = useRef<T | null>(null);
    const [width, setWidth] = useState(0);
    const resizeRafRef = useRef<number | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const scheduleWidth = (raw: number) => {
            const next = Math.round(raw);
            if (resizeRafRef.current != null) {
                cancelAnimationFrame(resizeRafRef.current);
            }
            resizeRafRef.current = requestAnimationFrame(() => {
                resizeRafRef.current = null;
                setWidth((prev) => (prev === next ? prev : next));
            });
        };

        const ro = new ResizeObserver(([entry]) => {
            scheduleWidth(entry.contentRect.width);
        });
        ro.observe(el);
        scheduleWidth(el.getBoundingClientRect().width);

        return () => {
            if (resizeRafRef.current != null) {
                cancelAnimationFrame(resizeRafRef.current);
            }
            ro.disconnect();
        };
    }, []);

    return [ref, width];
}
