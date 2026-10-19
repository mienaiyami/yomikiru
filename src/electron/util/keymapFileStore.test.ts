import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { BindingTrigger } from "@common/keybindings";
import { effectiveBindingsFor, emptyKeymapDocument, parsePhysicalBindingString } from "@common/keybindings";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FILE_BACKUP_SUFFIX } from "./file";
import { createKeymapFileStore } from "./keymapFileStore";

/**
 * Parses a known-good physical combination used as a test fixture.
 *
 * @throws {Error} If `raw` is not a valid physical binding string
 */
const mustParse = (raw: string): BindingTrigger => {
    const parsed = parsePhysicalBindingString(raw);
    if (!parsed.ok) throw new Error(`expected physical binding ${raw}`);
    return parsed.trigger;
};

describe("createKeymapFileStore", () => {
    const dirs: string[] = [];

    afterEach(() => {
        vi.restoreAllMocks();
        for (const dir of dirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        dirs.length = 0;
    });

    const tempKeymapPath = (): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-keymap-"));
        dirs.push(dir);
        return path.join(dir, "shortcuts.json");
    };

    it("creates a v1 envelope on a missing file", async () => {
        const keymapPath = tempKeymapPath();
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        const snap = await store.load();
        expect(snap.status).toBe("ready");
        expect(snap.document.overrides).toEqual({});
        expect(JSON.parse(fs.readFileSync(keymapPath, "utf8")).schemaVersion).toBe(1);
    });

    it("backs up then rewrites a current-format array, and a second load is a no-op migrate", async () => {
        const keymapPath = tempKeymapPath();
        fs.writeFileSync(keymapPath, JSON.stringify([{ command: "navToHome", keys: ["g"] }]));
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        const first = await store.load();
        expect(first.status).toBe("ready");
        expect(first.document.overrides.navToHome).toEqual([mustParse("g")]);
        expect(fs.existsSync(`${keymapPath}${FILE_BACKUP_SUFFIX}`)).toBe(true);
        expect(fs.readFileSync(`${keymapPath}${FILE_BACKUP_SUFFIX}`, "utf8")).toContain("navToHome");

        const second = createKeymapFileStore({ keymapPath, platform: "win32" });
        const again = await second.load();
        expect(again.document.overrides.navToHome).toEqual(first.document.overrides.navToHome);
        expect(again.document.revision).toBe(first.document.revision);
    });

    it("leaves the source intact when the pre-migrate backup copy fails", async () => {
        const keymapPath = tempKeymapPath();
        const original = JSON.stringify([{ command: "navToHome", keys: ["g"] }]);
        fs.writeFileSync(keymapPath, original);
        vi.spyOn(fsp, "copyFile").mockRejectedValueOnce(new Error("backup denied"));
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        const snap = await store.load();
        expect(snap.status).toBe("recovery");
        expect(fs.readFileSync(keymapPath, "utf8")).toBe(original);
        expect(fs.existsSync(`${keymapPath}${FILE_BACKUP_SUFFIX}`)).toBe(false);
    });

    it("does not overwrite a newer unsupported schema", async () => {
        const keymapPath = tempKeymapPath();
        const raw = { schemaVersion: 99, revision: 3, overrides: { secret: [] } };
        fs.writeFileSync(keymapPath, JSON.stringify(raw));
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        const snap = await store.load();
        expect(snap.status).toBe("readOnly");
        expect(JSON.parse(fs.readFileSync(keymapPath, "utf8"))).toEqual(raw);
        const edit = await store.applyEdit({ type: "resetAll", expectedRevision: 0 });
        expect(edit.ok).toBe(false);
        if (edit.ok) return;
        expect(edit.code).toBe("readOnly");
        expect(JSON.parse(fs.readFileSync(keymapPath, "utf8"))).toEqual(raw);
    });

    it("keeps a corrupt file and blocks normal edits until reset-all recovers", async () => {
        const keymapPath = tempKeymapPath();
        fs.writeFileSync(keymapPath, "not-json");
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        const snap = await store.load();
        expect(snap.status).toBe("recovery");
        expect(fs.readFileSync(keymapPath, "utf8")).toBe("not-json");
        const blocked = await store.applyEdit({
            type: "addBinding",
            commandId: "navToHome",
            trigger: mustParse("g"),
            expectedBindings: effectiveBindingsFor(emptyKeymapDocument(), "navToHome", "win32"),
        });
        expect(blocked.ok).toBe(false);
        if (blocked.ok) return;
        expect(blocked.code).toBe("recoveryBlocked");
        const recovered = await store.applyEdit({ type: "resetAll", expectedRevision: snap.document.revision });
        expect(recovered.ok).toBe(true);
        if (!recovered.ok) return;
        expect(recovered.snapshot.status).toBe("ready");
        expect(JSON.parse(fs.readFileSync(keymapPath, "utf8")).schemaVersion).toBe(1);
    });

    it("serializes two windows editing different commands and rejects a stale same-command edit", async () => {
        const keymapPath = tempKeymapPath();
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        await store.load();
        const homeExpected = effectiveBindingsFor(store.snapshot().document, "navToHome", "win32");
        const bookmarkExpected = effectiveBindingsFor(store.snapshot().document, "bookmark", "win32");

        const [homeResult, bookmarkResult] = await Promise.all([
            store.applyEdit({
                type: "addBinding",
                commandId: "navToHome",
                trigger: mustParse("g"),
                expectedBindings: homeExpected,
            }),
            store.applyEdit({
                type: "addBinding",
                commandId: "bookmark",
                trigger: mustParse("n"),
                expectedBindings: bookmarkExpected,
            }),
        ]);
        expect(homeResult.ok).toBe(true);
        expect(bookmarkResult.ok).toBe(true);
        if (!homeResult.ok || !bookmarkResult.ok) return;
        expect(store.snapshot().document.overrides.navToHome).toContainEqual(mustParse("g"));
        expect(store.snapshot().document.overrides.bookmark).toContainEqual(mustParse("n"));

        const stale = await store.applyEdit({
            type: "addBinding",
            commandId: "navToHome",
            trigger: mustParse("j"),
            expectedBindings: homeExpected,
        });
        expect(stale.ok).toBe(false);
        if (stale.ok) return;
        expect(stale.code).toBe("stale");
    });

    it("returns writeFailed and keeps the previous document when replace throws", async () => {
        const keymapPath = tempKeymapPath();
        const store = createKeymapFileStore({ keymapPath, platform: "win32" });
        await store.load();
        vi.spyOn(fsp, "writeFile").mockRejectedValueOnce(new Error("disk full"));
        const expected = effectiveBindingsFor(store.snapshot().document, "navToHome", "win32");
        const result = await store.applyEdit({
            type: "addBinding",
            commandId: "navToHome",
            trigger: mustParse("g"),
            expectedBindings: expected,
        });
        expect(result.ok).toBe(false);
        if (result.ok) return;
        expect(result.code).toBe("writeFailed");
        expect(result.snapshot.document.overrides.navToHome).toBeUndefined();
        const parsed = JSON.parse(fs.readFileSync(keymapPath, "utf8")) as { overrides: unknown };
        expect(parsed.overrides).toEqual({});
    });
});
