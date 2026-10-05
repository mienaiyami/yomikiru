import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    atomicWriteTextFile,
    backupFileIfAbsent,
    FILE_BACKUP_SUFFIX,
    fileExists,
    loadJsonFile,
    writeJsonFile,
} from "./file";

describe("electron file helpers", () => {
    const dirs: string[] = [];

    afterEach(() => {
        vi.restoreAllMocks();
        for (const dir of dirs) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
        dirs.length = 0;
    });

    /**
     * Host-OS temp file under a directory cleaned in afterEach.
     */
    const tempFilePath = (fileName: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-file-"));
        dirs.push(dir);
        return path.join(dir, fileName);
    };

    it("fileExists is true for an existing file and false when missing", async () => {
        const filePath = tempFilePath("exists.txt");
        expect(await fileExists(filePath)).toBe(false);
        fs.writeFileSync(filePath, "ok");
        expect(await fileExists(filePath)).toBe(true);
    });

    it("atomicWriteTextFile writes a new file and replaces an existing one", async () => {
        const destPath = tempFilePath("dest.txt");
        await atomicWriteTextFile(destPath, "first\n");
        expect(fs.readFileSync(destPath, "utf8")).toBe("first\n");
        await atomicWriteTextFile(destPath, "second\n");
        expect(fs.readFileSync(destPath, "utf8")).toBe("second\n");
        expect(fs.existsSync(`${destPath}.tmp`)).toBe(false);
    });

    it("atomicWriteTextFile unlinks the destination and retries when the first rename fails", async () => {
        const destPath = tempFilePath("retry.txt");
        fs.writeFileSync(destPath, "old");
        const rename = vi.spyOn(fsp, "rename");
        rename.mockRejectedValueOnce(new Error("EPERM"));
        await atomicWriteTextFile(destPath, "new\n");
        expect(fs.readFileSync(destPath, "utf8")).toBe("new\n");
        expect(rename).toHaveBeenCalledTimes(2);
    });

    it("loadJsonFile distinguishes missing, invalid, and ok", async () => {
        const filePath = tempFilePath("data.json");
        expect(await loadJsonFile(filePath)).toEqual({ kind: "missing" });
        fs.writeFileSync(filePath, "not-json");
        expect(await loadJsonFile(filePath)).toMatchObject({ kind: "invalidJson" });
        fs.writeFileSync(filePath, JSON.stringify({ a: 1 }));
        expect(await loadJsonFile(filePath)).toEqual({ kind: "ok", value: { a: 1 } });
    });

    it("writeJsonFile creates parent directories and pretty-prints", async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yomikiru-file-"));
        dirs.push(dir);
        const filePath = path.join(dir, "nested", "data.json");
        await writeJsonFile(filePath, { a: 1 });
        expect(fs.readFileSync(filePath, "utf8")).toBe(`${JSON.stringify({ a: 1 }, null, 2)}\n`);
    });

    it("backupFileIfAbsent writes a sibling once and does not overwrite it", async () => {
        const filePath = tempFilePath("data.json");
        fs.writeFileSync(filePath, "first");
        await backupFileIfAbsent(filePath);
        expect(fs.readFileSync(`${filePath}${FILE_BACKUP_SUFFIX}`, "utf8")).toBe("first");
        fs.writeFileSync(filePath, "second");
        await backupFileIfAbsent(filePath);
        expect(fs.readFileSync(`${filePath}${FILE_BACKUP_SUFFIX}`, "utf8")).toBe("first");
    });
});
