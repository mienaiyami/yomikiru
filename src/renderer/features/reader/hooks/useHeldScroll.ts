import { useCallback, useEffect, useRef } from "react";

type HeldScrollControls = {
    /** Begin (or replace) a session that scrolls by `intensity` each frame. */
    start: (intensity: number) => void;
    /** Idempotent; cancels the current session if any. */
    stop: () => void;
};

/**
 * Cancellable rAF loop for held reader scroll commands. Animation stays here,
 * not in Redux. Runtime calls {@link HeldScrollControls.stop} on keyup, blur,
 * and owner teardown.
 */
export const useHeldScroll = (scrollBy: (intensity: number) => void): HeldScrollControls => {
    const sessionRef = useRef<{ rafId: number } | null>(null);
    const scrollByRef = useRef(scrollBy);
    scrollByRef.current = scrollBy;

    const stop = useCallback(() => {
        const session = sessionRef.current;
        if (!session) return;
        cancelAnimationFrame(session.rafId);
        sessionRef.current = null;
    }, []);

    const start = useCallback(
        (intensity: number) => {
            stop();
            const session = { rafId: 0 };
            sessionRef.current = session;
            const anim = () => {
                if (sessionRef.current !== session) return;
                scrollByRef.current(intensity);
                session.rafId = requestAnimationFrame(anim);
            };
            session.rafId = requestAnimationFrame(anim);
        },
        [stop],
    );

    useEffect(() => () => stop(), [stop]);

    return { start, stop };
};
