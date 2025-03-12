import { useEffect, useCallback, useState, RefObject, useMemo } from "react";
import { useAppSelector } from "@store/hooks";
import { keyFormatter } from "@utils/keybindings";

export type ShortcutHandler = (e: KeyboardEvent) => void;

export type KeybindHandlerConfig = {
    command: ShortcutCommands;
    handler: (e: KeyboardEvent) => void;
    /**
     * @default true
     */
    preventDefault?: boolean;
    /**
     * @default true
     */
    stopPropagation?: boolean;
    /**
     * whether to allow the shortcut to trigger when in an input element
     * @default false
     */
    allowInInputs?: boolean;
    /**
     * whether to allow the shortcut to trigger when repeated (key held down)
     * @default true
     */
    allowRepeated?: boolean;
};

export type KeybindingsOptions = {
    /**
     * whether to use limited key formatting (ignores modifier keys when pressed alone)
     * @default true
     */
    limitedKeyFormat?: boolean;
    /**
     * element to attach the event listener to
     * @default window
     */
    targetElement?: Window | Document | HTMLElement | null;
    /**
     * whether the shortcuts should be active
     * @default true
     */
    enabled?: boolean;
    /**
     * if provided, shortcuts will only work when this element is focused
     */
    focusElement?: RefObject<HTMLElement>;
};

export const useKeybindings = (handlers: KeybindHandlerConfig[], options: KeybindingsOptions = {}) => {
    const {
        limitedKeyFormat = true,
        targetElement = typeof window !== "undefined" ? window : null,
        enabled = true,
        focusElement,
    } = options;

    const shortcuts = useAppSelector((store) => store.shortcuts);

    const shortcutsMapped = useMemo(() => {
        return Object.fromEntries(shortcuts.map((e) => [e.command, e.keys])) as Record<ShortcutCommands, string[]>;
    }, [shortcuts]);

    const isShortcutMatch = useCallback(
        (keyStr: string, command: ShortcutCommands) => {
            const keys = shortcutsMapped[command];
            return keys?.includes(keyStr) || false;
        },
        [shortcutsMapped],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (!enabled) return;

            if (focusElement && document.activeElement !== focusElement.current) return;

            const isInInput = ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(
                (e.target as HTMLElement)?.tagName,
            );

            if (window.app) {
                window.app.keyRepeated = e.repeat;
            }

            const keyStr = keyFormatter(e, limitedKeyFormat);
            if (keyStr === "") return;

            for (const {
                command,
                handler,
                preventDefault = true,
                stopPropagation = true,
                allowInInputs = false,
                allowRepeated = true,
            } of handlers) {
                if (isInInput && !allowInInputs) continue;

                if (e.repeat && !allowRepeated) continue;

                if (isShortcutMatch(keyStr, command)) {
                    if (preventDefault) e.preventDefault();
                    if (stopPropagation) e.stopPropagation();

                    handler(e);
                    return;
                }
            }
        },
        [enabled, focusElement, handlers, isShortcutMatch, limitedKeyFormat],
    );

    const handleKeyUp = useCallback(() => {
        if (window.app) {
            window.app.keydown = false;
        }
    }, []);

    useEffect(() => {
        if (!targetElement) return;
        const abortController = new AbortController();

        targetElement.addEventListener("keydown", handleKeyDown as EventListener, {
            signal: abortController.signal,
        });
        targetElement.addEventListener("keyup", handleKeyUp as EventListener, { signal: abortController.signal });

        return () => {
            abortController.abort();
        };
    }, [targetElement, handleKeyDown, handleKeyUp]);

    const triggerShortcut = useCallback(
        (command: ShortcutCommands) => {
            const handler = handlers.find((h) => h.command === command);
            if (handler) {
                // todo setup properly with keys
                const event = new KeyboardEvent("keydown", {
                    bubbles: true,
                    cancelable: true,
                });
                handler.handler(event);
            }
        },
        [handlers],
    );

    return {
        triggerShortcut,
        isShortcutMatch,
        shortcutsMapped,
    };
};
