import { useAppSelector } from "@store/hooks";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Window events swallowed in capture while a UI lock is active, so neither
 * bubbling app shortcuts nor the page behind the overlay can run.
 */
const UI_BLOCK_CAPTURE_EVENTS = [
    "keydown",
    "keyup",
    "keypress",
    "mousedown",
    "mouseup",
    "auxclick",
    "click",
    "dblclick",
    "contextmenu",
    "wheel",
    "drop",
    "dragover",
] as const;

/*
 * Registered at module load so this capture handler is ahead of feature
 * listeners added later in React effects (e.g. gallery details dir-up).
 */
let inputLocked = false;

/** Capture-phase swallow used while `inputLocked` is true. */
const swallowIfLocked = (e: Event) => {
    if (!inputLocked) return;
    e.preventDefault();
    e.stopImmediatePropagation();
};

if (typeof window !== "undefined") {
    for (const type of UI_BLOCK_CAPTURE_EVENTS) {
        window.addEventListener(type, swallowIfLocked, true);
    }
}

/**
 * Full-window, non-dismissible lock driven by `ui.blocks`. Covers mouse via the
 * overlay and keyboard / pointer shortcuts via capture-phase window listeners.
 * Dispatch `blockUi` / `unblockUi` from any feature.
 */
const UiBlockOverlay = () => {
    const { t } = useTranslation("common");
    const block = useAppSelector((store) => store.ui.blocks.at(-1) ?? null);
    const overlayRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        inputLocked = block !== null;
        if (block) overlayRef.current?.focus();
        return () => {
            inputLocked = false;
        };
    }, [block]);

    if (!block) return null;

    const label = block.message || t("app.uiBlocked");

    return (
        <div
            id="uiBlockOverlay"
            ref={overlayRef}
            role="alertdialog"
            aria-busy="true"
            aria-live="polite"
            aria-label={label}
            tabIndex={-1}
        >
            <div className="loadingText">{label}</div>
        </div>
    );
};

export default UiBlockOverlay;
