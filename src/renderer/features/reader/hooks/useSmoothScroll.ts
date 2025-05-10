import { useAppSelector } from "@store/hooks";
import { useEffect, RefObject } from "react";
import { shallowEqual } from "react-redux";

/**
 * Hook to add smooth scrolling to an element for wheel scrolling
 */
export const useSmoothScroll = (elementRef: RefObject<HTMLElement>): void => {
    const { overrideMouseWheelSpeed, mouseWheelScrollSpeed, mouseWheelScrollDuration } = useAppSelector(
        (state) => state.appSettings.readerSettings,
        shallowEqual,
    );
    useEffect(() => {
        if (!elementRef.current || !overrideMouseWheelSpeed) return;

        let isScrolling = false;
        const duration = mouseWheelScrollDuration;

        const el = elementRef.current;

        // easing function for smooth animation
        const easeInOutQuad = (t: number): number => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);

        const smoothScroll = (target: number) => {
            const start = el.scrollTop;
            const distance = target - start;
            const startTime = performance.now();

            const step = (currentTime: number) => {
                if (!elementRef.current) {
                    isScrolling = false;
                    return;
                }

                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const ease = easeInOutQuad(progress);
                elementRef.current.scrollTop = start + distance * ease;

                if (progress < 1) {
                    requestAnimationFrame(step);
                } else {
                    el.scrollTop = target;
                    isScrolling = false;
                }
            };

            requestAnimationFrame(step);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (!elementRef.current || isScrolling) return;

            // const delta = e.deltaY * mouseWheelScrollSpeed;
            // scrollTarget += delta;
            const delta = el.clientHeight * mouseWheelScrollSpeed * Math.sign(e.deltaY);
            let scrollTarget = el.scrollTop + delta;

            // clamp the scroll target to valid bounds
            scrollTarget = Math.max(0, Math.min(scrollTarget, el.scrollHeight - el.clientHeight));

            isScrolling = true;
            smoothScroll(scrollTarget);
        };

        el.addEventListener("wheel", onWheel, { passive: false });

        return () => {
            el?.removeEventListener("wheel", onWheel);
        };
    }, [elementRef, overrideMouseWheelSpeed, mouseWheelScrollSpeed, mouseWheelScrollDuration]);
};

export default useSmoothScroll;
