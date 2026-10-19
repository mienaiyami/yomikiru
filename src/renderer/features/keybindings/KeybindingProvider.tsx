import { useAppSelector } from "@store/hooks";
import { type ReactElement, type ReactNode, useEffect, useMemo } from "react";
import { createKeybindingRuntime } from "./runtime";
import { KeybindingRuntimeContext } from "./runtimeContext";

const POINTER_LOCK_EVENTS = [
    "mousedown",
    "mouseup",
    "auxclick",
    "click",
    "dblclick",
    "wheel",
    "drop",
    "dragover",
] as const;

type KeybindingProviderProps = {
    children: ReactNode;
};

/**
 * One keymap runtime and window ingress for this renderer.
 * UI lock swallows pointer/drop in capture; keyboard lock is the runtime.
 */
export const KeybindingProvider = ({ children }: KeybindingProviderProps): ReactElement => {
    const runtime = useMemo(() => createKeybindingRuntime(), []);
    const keymapDocument = useAppSelector((state) => state.shortcuts.document);
    const platform = useAppSelector((state) => state.shortcuts.platform);
    const locked = useAppSelector((state) => state.ui.blocks.length > 0);

    useEffect(() => {
        runtime.setDocument(keymapDocument, platform);
    }, [runtime, keymapDocument, platform]);

    useEffect(() => {
        runtime.setUiLocked(locked);
    }, [runtime, locked]);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            runtime.handleKeyDown(e);
        };
        const onKeyUp = (e: KeyboardEvent) => {
            runtime.handleKeyUp(e);
        };
        const onPointerDown = (e: MouseEvent) => {
            runtime.handlePointerDown(e);
        };
        const onPointerUp = (e: MouseEvent) => {
            runtime.handlePointerUp(e);
        };
        const onAuxClick = (e: MouseEvent) => {
            runtime.handlePointerDown(e);
        };
        const onBlur = () => {
            runtime.handleBlur();
        };
        const onVisibility = () => {
            if (document.visibilityState === "hidden") runtime.handleVisibilityHidden();
        };
        const onCompositionStart = () => {
            runtime.handleComposition(true);
        };
        const onCompositionEnd = () => {
            runtime.handleComposition(false);
        };
        window.addEventListener("keydown", onKeyDown, true);
        window.addEventListener("keyup", onKeyUp, true);
        window.addEventListener("mousedown", onPointerDown, true);
        window.addEventListener("mouseup", onPointerUp, true);
        window.addEventListener("auxclick", onAuxClick, true);
        window.addEventListener("blur", onBlur);
        document.addEventListener("visibilitychange", onVisibility);
        document.addEventListener("compositionstart", onCompositionStart, true);
        document.addEventListener("compositionend", onCompositionEnd, true);
        return () => {
            window.removeEventListener("keydown", onKeyDown, true);
            window.removeEventListener("keyup", onKeyUp, true);
            window.removeEventListener("mousedown", onPointerDown, true);
            window.removeEventListener("mouseup", onPointerUp, true);
            window.removeEventListener("auxclick", onAuxClick, true);
            window.removeEventListener("blur", onBlur);
            document.removeEventListener("visibilitychange", onVisibility);
            document.removeEventListener("compositionstart", onCompositionStart, true);
            document.removeEventListener("compositionend", onCompositionEnd, true);
        };
    }, [runtime]);

    useEffect(() => {
        if (!locked) return;
        const swallow = (e: Event) => {
            e.preventDefault();
            e.stopImmediatePropagation();
        };
        for (const type of POINTER_LOCK_EVENTS) {
            window.addEventListener(type, swallow, true);
        }
        return () => {
            for (const type of POINTER_LOCK_EVENTS) {
                window.removeEventListener(type, swallow, true);
            }
        };
    }, [locked]);

    return <KeybindingRuntimeContext.Provider value={runtime}>{children}</KeybindingRuntimeContext.Provider>;
};
