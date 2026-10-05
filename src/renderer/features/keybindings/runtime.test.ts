import { emptyKeymapDocument, type KeyboardCode } from "@common/keybindings";
import { describe, expect, it } from "vitest";
import { createKeybindingRuntime } from "./runtime";
import type { OwnerSpec } from "./types";

const keyDown = (code: KeyboardCode, key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
    new KeyboardEvent("keydown", { code, key, bubbles: true, cancelable: true, ...init });

/**
 * {@link KeyboardEvent} constructor does not set `target`; runtime routing
 * reads it for widget ownership.
 */
const keyDownOn = (
    eventTarget: EventTarget,
    code: KeyboardCode,
    key: string,
    init: KeyboardEventInit = {},
): KeyboardEvent => {
    const event = keyDown(code, key, init);
    Object.defineProperty(event, "target", { value: eventTarget });
    return event;
};

const keyUp = (code: KeyboardCode, key: string, init: KeyboardEventInit = {}): KeyboardEvent =>
    new KeyboardEvent("keyup", { code, key, bubbles: true, cancelable: true, ...init });

const mouseDown = (button: number): MouseEvent =>
    new MouseEvent("mousedown", { button, bubbles: true, cancelable: true });

/**
 * Runtime with catalog defaults and one app owner that records command ids.
 */
const appRuntime = (extra: Partial<OwnerSpec> = {}) => {
    const calls: string[] = [];
    const runtime = createKeybindingRuntime();
    runtime.setDocument(emptyKeymapDocument(), "win32");
    runtime.registerOwner({
        ownerId: "app",
        contextKinds: ["app"],
        visible: true,
        handlers: {
            navToHome: () => {
                calls.push("navToHome");
            },
            openSettings: () => {
                calls.push("openSettings");
            },
        },
        ...extra,
    });
    return { runtime, calls };
};

describe("keybinding runtime", () => {
    it("executes one winner for a matching app binding", () => {
        const { runtime, calls } = appRuntime();
        const e = keyDown("KeyH", "h");
        const result = runtime.handleKeyDown(e);
        expect(result).toMatchObject({ outcome: "handled", commandId: "navToHome" });
        expect(e.defaultPrevented).toBe(true);
        expect(calls).toEqual(["navToHome"]);
    });

    it("prefers a more specific owner over app for the same physical key", () => {
        const { runtime, calls } = appRuntime();
        const readerCalls: string[] = [];
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            handlers: {
                prevPage: () => {
                    readerCalls.push("prevPage");
                },
            },
        });
        runtime.handleKeyDown(keyDown("KeyA", "a"));
        expect(readerCalls).toEqual(["prevPage"]);
        expect(calls).toEqual([]);
    });

    it("does not execute a hidden owner", () => {
        const { runtime } = appRuntime();
        const readerCalls: string[] = [];
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: false,
            handlers: {
                prevPage: () => {
                    readerCalls.push("prevPage");
                },
            },
        });
        runtime.handleKeyDown(keyDown("KeyA", "a"));
        expect(readerCalls).toEqual([]);
    });

    it("treats a claiming owner without a handler as unavailable, not a fallthrough", () => {
        const { runtime, calls } = appRuntime();
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            handlers: {},
        });
        const result = runtime.handleKeyDown(keyDown("KeyA", "a"));
        expect(result.outcome).toBe("unavailable");
        expect(calls).toEqual([]);
    });

    it("ignores OS repeat for one-shot commands", () => {
        const { runtime, calls } = appRuntime();
        runtime.handleKeyDown(keyDown("KeyH", "h", { repeat: true }));
        expect(calls).toEqual([]);
    });

    it("blocks all commands while the UI lock is on", () => {
        const { runtime, calls } = appRuntime();
        runtime.setUiLocked(true);
        const e = keyDown("KeyH", "h");
        expect(runtime.handleKeyDown(e)).toEqual({ outcome: "blocked", reason: "uiLock" });
        expect(e.defaultPrevented).toBe(true);
        expect(calls).toEqual([]);
    });

    it("delivers input only to the recorder while recording", () => {
        const { runtime, calls } = appRuntime();
        const captured: string[] = [];
        runtime.beginRecording((live) => {
            if (live.kind === "keyboard") captured.push(live.code);
        });
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(captured).toEqual(["KeyH"]);
        expect(calls).toEqual([]);
        runtime.cancelRecording();
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(calls).toEqual(["navToHome"]);
    });

    it("cancels recording on Tab without capturing Tab as a binding", () => {
        const { runtime, calls } = appRuntime();
        const captured: string[] = [];
        runtime.beginRecording((live) => {
            if (live.kind === "keyboard") captured.push(live.code);
        });
        const tab = keyDown("Tab", "Tab");
        expect(runtime.handleKeyDown(tab)).toEqual({ outcome: "blocked", reason: "recorder" });
        expect(captured).toEqual([]);
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(calls).toEqual(["navToHome"]);
    });

    it("captures Shift+Space while recording even if the event target is a button", () => {
        const { runtime } = appRuntime();
        const captured: string[] = [];
        const button = document.createElement("button");
        document.body.appendChild(button);
        runtime.beginRecording((live) => {
            if (live.kind === "keyboard") captured.push(`${live.code}:${live.shift}`);
        });
        const event = keyDownOn(button, "Space", " ", { shiftKey: true });
        expect(runtime.handleKeyDown(event)).toEqual({ outcome: "blocked", reason: "recorder" });
        expect(captured).toEqual(["Space:true"]);
        button.remove();
    });

    it("runs onCancel when Escape ends recording without a capture", () => {
        const { runtime, calls } = appRuntime();
        let cancelled = 0;
        runtime.beginRecording(
            () => undefined,
            () => {
                cancelled += 1;
            },
        );
        expect(runtime.handleKeyDown(keyDown("Escape", "Escape"))).toEqual({
            outcome: "blocked",
            reason: "recorder",
        });
        expect(cancelled).toBe(1);
        expect(runtime.isRecording()).toBe(false);
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(calls).toEqual(["navToHome"]);
    });

    it("runs at most one Escape dismissal, most specific first", () => {
        const { runtime } = appRuntime();
        const order: string[] = [];
        runtime.registerOwner({
            ownerId: "settings",
            contextKinds: ["settings"],
            visible: true,
            onEscape: () => {
                order.push("settings");
                return true;
            },
        });
        runtime.registerOwner({
            ownerId: "modal",
            contextKinds: ["modal"],
            visible: true,
            parentOwnerId: "settings",
            onEscape: () => {
                order.push("modal");
                return true;
            },
        });
        const result = runtime.handleKeyDown(keyDown("Escape", "Escape"));
        expect(result.outcome).toBe("dismissed");
        expect(order).toEqual(["modal"]);
    });

    it("runs a nested searchWidget Escape before its settings parent when the field owns the event", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const order: string[] = [];
        const search = document.createElement("input");
        document.body.appendChild(search);
        runtime.registerOwner({
            ownerId: "settings",
            contextKinds: ["settings"],
            visible: true,
            onEscape: () => {
                order.push("settings");
                return true;
            },
        });
        runtime.registerOwner({
            ownerId: "settings-search",
            contextKinds: ["searchWidget"],
            visible: true,
            parentOwnerId: "settings",
            ownsEventTarget: (node) => node === search,
            onEscape: () => {
                order.push("search");
                return true;
            },
        });
        runtime.handleKeyDown(keyDownOn(search, "Escape", "Escape"));
        search.remove();
        expect(order).toEqual(["search"]);
    });

    it("does not let an unfocused nested searchWidget steal Escape from settings", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const order: string[] = [];
        runtime.registerOwner({
            ownerId: "settings",
            contextKinds: ["settings"],
            visible: true,
            onEscape: () => {
                order.push("settings");
                return true;
            },
        });
        runtime.registerOwner({
            ownerId: "settings-search",
            contextKinds: ["searchWidget"],
            visible: true,
            parentOwnerId: "settings",
            onEscape: () => {
                order.push("search");
                return true;
            },
        });
        runtime.handleKeyDown(keyDown("Escape", "Escape"));
        expect(order).toEqual(["settings"]);
    });

    it("does not run home commands while Settings is open", () => {
        const homeCalls: string[] = [];
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        runtime.registerOwner({
            ownerId: "app",
            contextKinds: ["app"],
            visible: true,
            handlers: { navToHome: () => homeCalls.push("app-home") },
        });
        runtime.registerOwner({
            ownerId: "home",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                cycleBar1Next: () => {
                    homeCalls.push("cycle");
                },
            },
        });
        runtime.registerOwner({
            ownerId: "settings",
            contextKinds: ["settings"],
            visible: true,
            handlers: {},
        });
        runtime.handleKeyDown(keyDown("BracketRight", "]", { altKey: true }));
        expect(homeCalls).toEqual([]);
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(homeCalls).toEqual(["app-home"]);
    });

    it("starts and stops a held session; unrelated keyup does not cancel it", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        let starts = 0;
        let stops = 0;
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            heldHandlers: {
                scrollDown: {
                    start: () => {
                        starts += 1;
                    },
                    stop: () => {
                        stops += 1;
                    },
                },
            },
        });
        runtime.handleKeyDown(keyDown("KeyS", "s"));
        expect(starts).toBe(1);
        runtime.handleKeyUp(keyUp("KeyA", "a"));
        expect(stops).toBe(0);
        runtime.handleKeyUp(keyUp("KeyS", "s"));
        expect(stops).toBe(1);
    });

    it("cancels a chord session when a required modifier is released", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        let stops = 0;
        runtime.registerOwner({
            ownerId: "app",
            contextKinds: ["app"],
            visible: true,
            heldHandlers: {},
            handlers: {},
        });
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            heldHandlers: {
                largeScrollReverse: {
                    start: () => undefined,
                    stop: () => {
                        stops += 1;
                    },
                },
            },
        });
        runtime.handleKeyDown(keyDown("Space", " ", { shiftKey: true }));
        runtime.handleKeyUp(keyUp("ShiftLeft", "Shift"));
        expect(stops).toBe(1);
    });

    it("does not keep a stale handler after update, and unregister does not remove a newer slot", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const first = runtime.registerOwner({
            ownerId: "app",
            contextKinds: ["app"],
            visible: true,
            handlers: { navToHome: () => calls.push("old") },
        });
        first.update({
            ownerId: "app",
            contextKinds: ["app"],
            visible: true,
            handlers: { navToHome: () => calls.push("new") },
        });
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(calls).toEqual(["new"]);
        const second = runtime.registerOwner({
            ownerId: "app",
            contextKinds: ["app"],
            visible: true,
            handlers: { navToHome: () => calls.push("newer") },
        });
        first.unregister();
        runtime.handleKeyDown(keyDown("KeyH", "h"));
        expect(calls).toEqual(["new", "newer"]);
        second.unregister();
    });

    it("routes mouse back to prevPage and consumes the event", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            handlers: { prevPage: () => calls.push("prev") },
        });
        const e = mouseDown(3);
        expect(runtime.handlePointerDown(e).outcome).toBe("handled");
        expect(e.defaultPrevented).toBe(true);
        expect(calls).toEqual(["prev"]);
    });

    it("cancels held sessions on blur", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        let stops = 0;
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            heldHandlers: {
                scrollDown: {
                    start: () => undefined,
                    stop: () => {
                        stops += 1;
                    },
                },
            },
        });
        runtime.handleKeyDown(keyDown("KeyS", "s"));
        runtime.handleBlur();
        expect(stops).toBe(1);
    });

    it("picks a sibling home owner that has the command, not one that only claims the context", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const focused: string[] = [];
        runtime.registerOwner({
            ownerId: "home-cycle",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                cycleBar1Next: () => undefined,
            },
        });
        runtime.registerOwner({
            ownerId: "home-search",
            contextKinds: ["home"],
            visible: true,
            tieOrder: 0,
            handlers: {
                focusPageSearch: () => {
                    focused.push("search");
                },
            },
        });
        runtime.handleKeyDown(keyDown("Slash", "/"));
        expect(focused).toEqual(["search"]);
    });

    it("prefers a lower tieOrder among same-context search owners", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const focused: string[] = [];
        runtime.registerOwner({
            ownerId: "locations",
            contextKinds: ["home"],
            visible: true,
            tieOrder: 5,
            handlers: {
                focusPageSearch: () => {
                    focused.push("locations");
                },
            },
        });
        runtime.registerOwner({
            ownerId: "history",
            contextKinds: ["home"],
            visible: true,
            tieOrder: 3,
            handlers: {
                focusPageSearch: () => {
                    focused.push("history");
                },
            },
        });
        runtime.handleKeyDown(keyDown("Slash", "/"));
        expect(focused).toEqual(["history"]);
    });

    it("does not let an unfocused searchWidget steal reader ArrowDown", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        runtime.registerOwner({
            ownerId: "list",
            contextKinds: ["searchWidget"],
            visible: true,
            focusRoot: () => document.createElement("input"),
            handlers: {
                listDown: () => {
                    calls.push("list");
                },
            },
        });
        runtime.registerOwner({
            ownerId: "manga",
            contextKinds: ["mangaReader"],
            visible: true,
            heldHandlers: {
                scrollDown: {
                    start: () => {
                        calls.push("scroll");
                    },
                    stop: () => undefined,
                },
            },
        });
        runtime.handleKeyDown(keyDown("ArrowDown", "ArrowDown"));
        expect(calls).toEqual(["scroll"]);
    });

    it("routes contextMenu to a focused searchWidget list over a home owner", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const listRoot = document.createElement("div");
        document.body.appendChild(listRoot);
        runtime.registerOwner({
            ownerId: "home",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                dirUp: () => {
                    calls.push("home");
                },
            },
        });
        runtime.registerOwner({
            ownerId: "list",
            contextKinds: ["searchWidget"],
            visible: true,
            ownsEventTarget: (node) => node instanceof Node && listRoot.contains(node),
            handlers: {
                contextMenu: () => {
                    calls.push("list");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(listRoot, "Slash", "/", { ctrlKey: true }));
        listRoot.remove();
        expect(result).toMatchObject({ outcome: "handled", commandId: "contextMenu" });
        expect(calls).toEqual(["list"]);
    });

    it("moves a menu owner that also claims searchWidget with ArrowDown", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const menuRoot = document.createElement("div");
        document.body.appendChild(menuRoot);
        runtime.registerOwner({
            ownerId: "context-menu",
            contextKinds: ["menu", "searchWidget"],
            visible: true,
            ownsEventTarget: (node) => node instanceof Node && menuRoot.contains(node),
            handlers: {
                listDown: () => {
                    calls.push("menu");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(menuRoot, "ArrowDown", "ArrowDown"));
        menuRoot.remove();
        expect(result).toMatchObject({ outcome: "handled", commandId: "listDown" });
        expect(calls).toEqual(["menu"]);
    });

    it("keeps a focused nested searchWidget under a menu overlay for listDown", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const row = document.createElement("button");
        document.body.appendChild(row);
        runtime.registerOwner({
            ownerId: "popover",
            contextKinds: ["menu"],
            visible: true,
            onEscape: () => true,
        });
        runtime.registerOwner({
            ownerId: "panel-list",
            contextKinds: ["searchWidget"],
            visible: true,
            ownsEventTarget: (node) => node === row,
            handlers: {
                listDown: () => {
                    calls.push("panel");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(row, "ArrowDown", "ArrowDown"));
        row.remove();
        expect(result).toMatchObject({ outcome: "handled", commandId: "listDown" });
        expect(calls).toEqual(["panel"]);
    });

    it("does not keep an unfocused searchWidget under a menu overlay", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const elsewhere = document.createElement("div");
        document.body.appendChild(elsewhere);
        runtime.registerOwner({
            ownerId: "popover",
            contextKinds: ["menu"],
            visible: true,
            onEscape: () => true,
        });
        runtime.registerOwner({
            ownerId: "panel-list",
            contextKinds: ["searchWidget"],
            visible: true,
            ownsEventTarget: () => false,
            handlers: {
                listDown: () => {
                    calls.push("panel");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(elsewhere, "ArrowDown", "ArrowDown"));
        elsewhere.remove();
        expect(result.outcome).toBe("unmatched");
        expect(calls).toEqual([]);
    });

    it("runs reader contextMenu when a nested find field is focused", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const readerRoot = document.createElement("div");
        const findInput = document.createElement("input");
        readerRoot.appendChild(findInput);
        document.body.appendChild(readerRoot);
        runtime.registerOwner({
            ownerId: "book",
            contextKinds: ["bookReader"],
            visible: true,
            focusRoot: () => readerRoot,
            handlers: {
                contextMenu: () => {
                    calls.push("reader");
                },
            },
        });
        runtime.registerOwner({
            ownerId: "find",
            contextKinds: ["bookReader"],
            visible: true,
            parentOwnerId: "book",
            focusRoot: () => findInput,
            onEscape: () => true,
        });
        const result = runtime.handleKeyDown(keyDownOn(findInput, "Slash", "/", { ctrlKey: true }));
        readerRoot.remove();
        expect(result).toMatchObject({ outcome: "handled", commandId: "contextMenu" });
        expect(calls).toEqual(["reader"]);
    });

    it("runs contextMenu for the Menu key when code is Unidentified", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        runtime.registerOwner({
            ownerId: "home",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                contextMenu: () => {
                    calls.push("menu");
                },
            },
        });
        const event = new KeyboardEvent("keydown", {
            code: "Unidentified",
            key: "ContextMenu",
            bubbles: true,
            cancelable: true,
        });
        const result = runtime.handleKeyDown(event);
        expect(result).toMatchObject({ outcome: "handled", commandId: "contextMenu" });
        expect(calls).toEqual(["menu"]);
        expect(event.defaultPrevented).toBe(true);
    });

    it("runs unchorded contextMenu while the list's own search field is focused", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const search = document.createElement("input");
        document.body.appendChild(search);
        runtime.registerOwner({
            ownerId: "list",
            contextKinds: ["searchWidget"],
            visible: true,
            ownsEventTarget: (node) => node === search,
            handlers: {
                contextMenu: () => {
                    calls.push("list");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(search, "ContextMenu", "ContextMenu"));
        search.remove();
        expect(result).toMatchObject({ outcome: "handled", commandId: "contextMenu" });
        expect(calls).toEqual(["list"]);
    });

    it("does not run unchorded contextMenu in a foreign text field", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const foreign = document.createElement("input");
        document.body.appendChild(foreign);
        runtime.registerOwner({
            ownerId: "home",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                contextMenu: () => {
                    calls.push("home");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(foreign, "ContextMenu", "ContextMenu"));
        foreign.remove();
        expect(result.outcome).toBe("unmatched");
        expect(calls).toEqual([]);
    });

    it("does not run unchorded Slash while a list search field is focused", () => {
        const runtime = createKeybindingRuntime();
        runtime.setDocument(emptyKeymapDocument(), "win32");
        const calls: string[] = [];
        const search = document.createElement("input");
        document.body.appendChild(search);
        runtime.registerOwner({
            ownerId: "home",
            contextKinds: ["home"],
            visible: true,
            handlers: {
                focusPageSearch: () => {
                    calls.push("focus");
                },
            },
        });
        const result = runtime.handleKeyDown(keyDownOn(search, "Slash", "/"));
        search.remove();
        expect(result.outcome).toBe("unmatched");
        expect(calls).toEqual([]);
    });
});
